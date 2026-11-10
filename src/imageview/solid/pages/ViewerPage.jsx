import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
  untrack,
} from 'solid-js'
import { MIN_ZOOM, MAX_ZOOM } from '../lib/constants'
import { clamp, findAnnotationKey, getFitState } from '../lib/annotations'

// Keep a compact sliding window so large archives do not allocate dozens of
// decoded previews before the user needs them.
const PREFETCH_FORWARD_COUNT = 8
const PREFETCH_BACKWARD_COUNT = 2
const PREFETCH_OFFSETS = [
  0,
  ...Array.from({ length: PREFETCH_FORWARD_COUNT }, (_, index) => index + 1),
  ...Array.from({ length: PREFETCH_BACKWARD_COUNT }, (_, index) => -(index + 1)),
]
export default function ViewerPage(props) {
  const [viewerImages, setViewerImages] = createSignal(props.source.images)
  const [viewerIndex, setViewerIndex] = createSignal(props.initialRouteState.index)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [viewerTx, setViewerTx] = createSignal({ scale: 1, panX: 0, panY: 0 })
  const [viewerAnnotations] = createSignal(props.source.annotations)
  const [showBoxes, setShowBoxes] = createSignal(false)
  const [extractedUrls, setExtractedUrls] = createSignal({})
  const [displayedViewerIndex, setDisplayedViewerIndex] = createSignal(
    props.initialRouteState.index,
  )
  const [image1Url, setImage1Url] = createSignal('')
  const [image2Url, setImage2Url] = createSignal('')
  const [activeBuffer, setActiveBuffer] = createSignal(1) // 1 or 2
  const [paintRevision, setPaintRevision] = createSignal(0)
  const decodedUrls = new Set()
  const decodedImages = new Map()
  const [imageError, setImageError] = createSignal('')
  const [retry, setRetry] = createSignal(0)
  const requests = new Map()
  const decodePromises = new Map()
  const paintedUrls = new Set()
  const paintPromises = new Map()

  function activatePaintedBuffer(buffer, url) {
    if (!paintedUrls.has(url)) return
    const bufferUrl = buffer === 1 ? image1Url() : image2Url()
    if (bufferUrl !== url || extractedUrls()[viewerIndex()] !== url) return

    setDisplayedViewerIndex(viewerIndex())
    setActiveBuffer(buffer)
  }

  function prePaintBuffer(buffer, url) {
    if (!url) return
    if (paintedUrls.has(url)) {
      activatePaintedBuffer(buffer, url)
      return
    }
    if (paintPromises.has(url)) return

    const paintPromise = new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
      .then(() => {
        paintedUrls.add(url)
        activatePaintedBuffer(buffer, url)
        setPaintRevision((revision) => revision + 1)
      })
      .finally(() => paintPromises.delete(url))

    paintPromises.set(url, paintPromise)
  }

  const displayedImage = () => {
    const list = viewerImages()
    if (list.length === 0) return null
    return list[Math.min(Math.max(displayedViewerIndex(), 0), list.length - 1)]
  }

  const displayedFrameName = () => {
    const image = displayedImage()
    return image?.frameId ?? displayedViewerIndex() + 1
  }

  const displayedFileName = () => displayedImage()?.name.replace(/\\/g, '/').split('/').pop() || ''

  createEffect(() => {
    const url = extractedUrls()[viewerIndex()]
    if (!url) return

    const currentActive = activeBuffer()
    const activeUrl = currentActive === 1 ? image1Url() : image2Url()

    // If the target URL is already loaded and active, we just sync displayedViewerIndex immediately
    if (url === activeUrl) {
      setDisplayedViewerIndex(viewerIndex())
      return
    }

    const inactiveUrl = currentActive === 1 ? image2Url() : image1Url()

    if (url === inactiveUrl) {
      activatePaintedBuffer(currentActive === 1 ? 2 : 1, url)
      return
    }

    // If the active buffer is empty (initial load), load directly into it
    if (currentActive === 1 && !image1Url()) {
      setImage1Url(url)
      setDisplayedViewerIndex(viewerIndex()) // sync immediately for first load
      return
    }
    if (currentActive === 2 && !image2Url()) {
      setImage2Url(url)
      setDisplayedViewerIndex(viewerIndex()) // sync immediately for first load
      return
    }

    // Otherwise, load into the inactive buffer to prevent flash
    if (currentActive === 1) {
      setImage2Url(url)
    } else {
      setImage1Url(url)
    }
  })

  function preDecodeUrl(url) {
    if (decodedUrls.has(url)) return Promise.resolve()
    if (decodePromises.has(url)) return decodePromises.get(url)

    const img = new Image()
    decodedImages.set(url, img)
    img.src = url
    const decodePromise = (
      img.decode
        ? img.decode()
        : new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
          })
    )
      .then(() => decodedUrls.add(url))
      .catch((error) => { decodedImages.delete(url); throw error })
      .finally(() => decodePromises.delete(url))

    decodePromises.set(url, decodePromise)
    return decodePromise
  }

  let searchInput
  let viewerStage = null
  let viewerDrag = null
  let viewerTouch = null
  let lastFitScale = 1
  let disposed = false

  const activeImage = () => {
    const list = viewerImages()
    if (list.length === 0) return null
    return list[Math.min(Math.max(viewerIndex(), 0), list.length - 1)]
  }

  let lastIndex = props.initialRouteState.index
  let direction = 1
  const releaseUrl = (url) => {
    decodedUrls.delete(url)
    decodedImages.delete(url)
    paintedUrls.delete(url)
    URL.revokeObjectURL(url)
  }

  onCleanup(() => {
    disposed = true
    for (const request of requests.values()) request.controller.abort()
    requests.clear()
    Object.values(extractedUrls()).forEach(releaseUrl)
    decodedImages.clear()
    decodePromises.clear()
    paintPromises.clear()
    document.body.style.cursor = ''
  })

  createEffect(() => {
    const index = viewerIndex()
    retry()
    const records = viewerImages()
    if (index !== lastIndex) direction = index > lastIndex ? 1 : -1
    lastIndex = index
    setImageError('')
    const offsets = PREFETCH_OFFSETS.map(offset => offset * direction)
    const wanted = new Set([index])
    let bytes = records[index] ? records[index].width * records[index].height * 4 : 0
    for (const offset of offsets.slice(1)) {
      const next = index + offset
      const record = records[next]
      if (!record) continue
      const cost = record.width * record.height * 4 || 16 * 1024 * 1024
      if (bytes + cost > 256 * 1024 * 1024) continue
      bytes += cost
      wanted.add(next)
    }

    untrack(() => {
      for (const [idx, request] of requests) {
        // Promote an active frame by restarting a queued prefetch at high priority.
        if (!wanted.has(idx) || (idx === index && !request.priority)) {
          request.controller.abort()
          requests.delete(idx)
        }
      }
      setExtractedUrls(current => {
        const next = { ...current }
        for (const [key, url] of Object.entries(next)) {
          if (!wanted.has(Number(key)) && url !== image1Url() && url !== image2Url()) {
            releaseUrl(url)
            delete next[key]
          }
        }
        return next
      })
      const fetchImage = (idx, priority) => {
        if (requests.has(idx) || extractedUrls()[idx] || !records[idx]) return
        const controller = new AbortController()
        const request = { controller, priority }
        requests.set(idx, request)
        props.source.getImage(records[idx].key, { priority, signal: controller.signal })
          .then(async blob => {
            if (disposed || controller.signal.aborted) return
            const url = URL.createObjectURL(blob)
            try {
              await preDecodeUrl(url)
              if (disposed || controller.signal.aborted) { releaseUrl(url); return }
              setExtractedUrls(current => {
                if (current[idx]) { releaseUrl(url); return current }
                return { ...current, [idx]: url }
              })
            } catch (error) { releaseUrl(url); throw error }
          })
          .catch(error => {
            if (!disposed && !controller.signal.aborted && idx === viewerIndex()) {
              setImageError(error.message || 'Không tải được ảnh.')
            }
          })
          .finally(() => { if (requests.get(idx) === request) requests.delete(idx) })
      }
      fetchImage(index, true)
      const timer = setTimeout(() => {
        for (const offset of offsets.slice(1)) if (wanted.has(index + offset)) fetchImage(index + offset, false)
      }, 30)
      onCleanup(() => clearTimeout(timer))
    })
  })

  // Sync index with URL and search query
  createEffect(() => {
    const displayImages = viewerImages()
    const maxIndex = Math.max(0, displayImages.length - 1)
    const safeIndex = Math.min(Math.max(viewerIndex(), 0), maxIndex)

    if (safeIndex !== viewerIndex()) {
      setViewerIndex(safeIndex)
      return
    }

    props.source.onIndexChange?.(safeIndex)
    if (displayImages[safeIndex]) {
      if (!searchInput?.matches(':focus')) {
        setSearchQuery('')
      }
    }
  })

  function goToPreviousImage() {
    setViewerIndex((current) => Math.max(0, current - 1))
  }

  function goToNextImage() {
    const displayImages = viewerImages()
    setViewerIndex((current) => Math.min(displayImages.length - 1, current + 1))
  }

  function constrainViewerPan(tx, stage) {
    if (!stage) return tx
    const { scale, panX, panY } = tx

    const bounds = stage.getBoundingClientRect()
    const stageWidth = bounds.width
    const stageHeight = bounds.height

    const img = displayedImage()
    if (!img || img.width === 0 || img.height === 0) return tx

    const imgWidth = img.width * scale
    const imgHeight = img.height * scale

    const maxPanX = imgWidth + stageWidth * 5
    const maxPanY = imgHeight + stageHeight * 5

    const constrainedPanX = Math.min(Math.max(panX, -maxPanX), maxPanX)
    const constrainedPanY = Math.min(Math.max(panY, -maxPanY), maxPanY)

    return { scale, panX: constrainedPanX, panY: constrainedPanY }
  }

  function resetViewerZoom() {
    const stage = viewerStage
    const img = displayedImage()

    if (stage && img && img.width > 0) {
      const fit = getFitState(img.width, img.height, stage)
      setViewerTx(fit)
      lastFitScale = fit.scale
    } else {
      const reset = { scale: 1, panX: 0, panY: 0 }
      setViewerTx(reset)
      lastFitScale = 1
    }
  }

  function refreshVisibleImage() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const host = viewerStage?.getRootNode()?.host
      const pane = host?.closest('.imageview-pane')
      if (disposed || !viewerStage || pane?.hidden) return

      const image = viewerStage.querySelectorAll('.viewer-image')[activeBuffer() - 1]
      const url = extractedUrls()[viewerIndex()]
      if (!image || !url || image.getAttribute('src') !== url) return

      const refresh = () => {
        if (disposed) return
        setViewerTx(current => ({ ...current }))
        setPaintRevision(revision => revision + 1)
      }
      if (image.decode) void image.decode().then(refresh, refresh)
      else refresh()
    }))
  }

  // Keep zoom controls centered around the middle of the viewport. This gives
  // keyboard and touch users the same predictable result as wheel zooming.
  function zoomViewerBy(factor) {
    if (!viewerStage) return

    const { scale, panX, panY } = viewerTx()
    const bounds = viewerStage.getBoundingClientRect()
    const cx = bounds.width / 2
    const cy = bounds.height / 2
    const ix = (cx - panX) / scale
    const iy = (cy - panY) / scale
    const nextScale = clamp(scale * factor, MIN_ZOOM, MAX_ZOOM)

    setViewerTx(
      constrainViewerPan(
        {
          scale: nextScale,
          panX: cx - ix * nextScale,
          panY: cy - iy * nextScale,
        },
        viewerStage,
      ),
    )
  }

  // Maintain zoom or reset to fit when switching images
  createEffect(() => {
    // Run this when displayed index actually changes
    const dispIdx = displayedViewerIndex()

    untrack(() => {
      const currentScale = viewerTx().scale
      const isAtFitScale = Math.abs(currentScale - lastFitScale) < 0.01
      const stage = viewerStage
      const img = displayedImage()

      // Image not loaded yet (width=0) — keep current viewerTx, will be handled in onLoad
      if (!img || img.width === 0) return

      if (isAtFitScale) {
        resetViewerZoom()
      }
      // User has zoomed — keep scale + pan exactly as-is for position comparison
    })
  })

  // Fit scale when mode matches
  onMount(() => {
    resetViewerZoom()
    const observer = new ResizeObserver(() => {
      if (Math.abs(viewerTx().scale - lastFitScale) < 0.01) resetViewerZoom()
    })
    if (viewerStage) observer.observe(viewerStage)
    const host = viewerStage?.getRootNode()?.host
    const pane = host?.closest('.imageview-pane')
    const paneObserver = pane ? new MutationObserver(() => {
      if (!pane.hidden) refreshVisibleImage()
    }) : null
    paneObserver?.observe(pane, { attributes: true, attributeFilter: ['hidden'] })
    const onVisibilityChange = () => { if (!document.hidden) refreshVisibleImage() }
    window.addEventListener('focus', refreshVisibleImage)
    document.addEventListener('visibilitychange', onVisibilityChange)
    onCleanup(() => {
      observer.disconnect()
      paneObserver?.disconnect()
      window.removeEventListener('focus', refreshVisibleImage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })
  })

  // Wheel zoom effect
  function onWheel(event) {
    event.preventDefault()
    if (!viewerStage) return

    const { scale, panX, panY } = viewerTx()
    const bounds = viewerStage.getBoundingClientRect()
    const cx = event.clientX - bounds.left
    const cy = event.clientY - bounds.top

    const ix = (cx - panX) / scale
    const iy = (cy - panY) / scale

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9
    let newScale = scale * zoomFactor

    newScale = Math.min(Math.max(newScale, MIN_ZOOM), MAX_ZOOM)

    const newPanX = cx - ix * newScale
    const newPanY = cy - iy * newScale

    const newTx = { scale: newScale, panX: newPanX, panY: newPanY }
    const constrainedTx = constrainViewerPan(newTx, viewerStage)
    setViewerTx(constrainedTx)
  }

  // Ref callback to cleanly handle mount/unmount event bindings
  const handleStageRef = (el) => {
    if (viewerStage) {
      viewerStage.removeEventListener('wheel', onWheel)
    }
    viewerStage = el
    if (el) {
      el.addEventListener('wheel', onWheel, { passive: false })
    }
  }

  onCleanup(() => {
    if (viewerStage) {
      viewerStage.removeEventListener('wheel', onWheel)
    }
  })

  // Keyboard navigation
  onMount(() => {
    function onKeyDown(event) {
      const host = viewerStage?.getRootNode()?.host
      const imageViewPane = host?.closest('.imageview-pane')
      if (!host || !imageViewPane || imageViewPane.hidden) return
      const target = event.composedPath()[0] || event.target

      if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
        event.preventDefault()
        event.stopPropagation()
        if (searchInput) searchInput.focus()
        return
      }

      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return

      if (event.key === 'ArrowRight' || event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        goToNextImage()
      } else if (event.key === 'ArrowLeft' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        goToPreviousImage()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

  function handleViewerDoubleClick() {
    resetViewerZoom()
  }

  function handleViewerMouseDown(event) {
    event.preventDefault()
    viewerStage?.focus()
    if (searchInput) searchInput.blur()
    viewerDrag = { lastX: event.clientX, lastY: event.clientY }
    document.body.style.cursor = 'grabbing'
  }

  function handleViewerMouseMove(event) {
    if (!viewerDrag) return

    const dx = event.clientX - viewerDrag.lastX
    const dy = event.clientY - viewerDrag.lastY
    viewerDrag = { lastX: event.clientX, lastY: event.clientY }

    const { scale, panX, panY } = viewerTx()
    const newTx = { scale, panX: panX + dx, panY: panY + dy }
    const constrainedTx = constrainViewerPan(newTx, viewerStage)
    setViewerTx(constrainedTx)
  }

  function handleViewerMouseUp() {
    viewerDrag = null
    document.body.style.cursor = ''
  }

  function getTouchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    )
  }

  function handleViewerTouchStart(event) {
    if (searchInput) searchInput.blur()
    const { touches } = event
    if (touches.length === 2 && viewerStage) {
      event.preventDefault()
      const bounds = viewerStage.getBoundingClientRect()
      const centerX = (touches[0].clientX + touches[1].clientX) / 2 - bounds.left
      const centerY = (touches[0].clientY + touches[1].clientY) / 2 - bounds.top
      const tx = viewerTx()
      viewerTouch = {
        distance: getTouchDistance(touches),
        tx,
        imageX: (centerX - tx.panX) / tx.scale,
        imageY: (centerY - tx.panY) / tx.scale,
      }
    } else if (touches.length === 1) {
      const touch = touches[0]
      viewerTouch = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        scale: viewerTx().scale,
      }
    }
  }

  function handleViewerTouchMove(event) {
    if (!viewerTouch || !viewerStage) return
    event.preventDefault()
    const { touches } = event
    if (touches.length === 2 && viewerTouch.distance) {
      const bounds = viewerStage.getBoundingClientRect()
      const centerX = (touches[0].clientX + touches[1].clientX) / 2 - bounds.left
      const centerY = (touches[0].clientY + touches[1].clientY) / 2 - bounds.top
      const scale = clamp(
        viewerTouch.tx.scale * (getTouchDistance(touches) / viewerTouch.distance),
        MIN_ZOOM,
        MAX_ZOOM,
      )
      setViewerTx(
        constrainViewerPan(
          {
            scale,
            panX: centerX - viewerTouch.imageX * scale,
            panY: centerY - viewerTouch.imageY * scale,
          },
          viewerStage,
        ),
      )
      return
    }

    if (touches.length === 1 && viewerTouch.lastX != null) {
      const touch = touches[0]
      const tx = viewerTx()
      setViewerTx(
        constrainViewerPan(
          {
            scale: tx.scale,
            panX: tx.panX + touch.clientX - viewerTouch.lastX,
            panY: tx.panY + touch.clientY - viewerTouch.lastY,
          },
          viewerStage,
        ),
      )
      viewerTouch.lastX = touch.clientX
      viewerTouch.lastY = touch.clientY
    }
  }

  function handleViewerTouchEnd() {
    if (
      viewerTouch?.startX != null &&
      Math.abs(viewerTouch.startX - viewerTouch.lastX) >= 64 &&
      Math.abs(viewerTouch.startX - viewerTouch.lastX) >
        Math.abs(viewerTouch.startY - viewerTouch.lastY) &&
      Math.abs(viewerTouch.scale - lastFitScale) < 0.01
    ) {
      if (viewerTouch.startX > viewerTouch.lastX) goToNextImage()
      else goToPreviousImage()
    }
    viewerTouch = null
  }

  function handleViewerImageLoad(event) {
    const { naturalWidth, naturalHeight } = event.target
    if (!naturalWidth) return

    // Find which index this loaded URL belongs to (not necessarily viewerIndex
    // which may have changed during loading).
    const loadedUrl = event.target.src
    const urls = extractedUrls()
    let loadedIdx = -1
    for (const [idxStr, url] of Object.entries(urls)) {
      if (url === loadedUrl) {
        loadedIdx = parseInt(idxStr, 10)
        break
      }
    }
    if (loadedIdx < 0) return

    const list = viewerImages()
    const img = list[Math.min(Math.max(loadedIdx, 0), list.length - 1)]
    if (!img || img.width > 0 || img.height > 0) return

    const wasZero = !img.width || img.width === 0

    setViewerImages((current) =>
      current.map((item) =>
        item.id === img.id ? { ...item, width: naturalWidth, height: naturalHeight } : item,
      ),
    )

    if (wasZero) {
      setTimeout(() => {
        const currentScale = viewerTx().scale
        const isAtFitScale = Math.abs(currentScale - lastFitScale) < 0.01
        if (isAtFitScale) {
          resetViewerZoom()
        }
      }, 0)
    }
  }

  // Memoised annotation data for the currently displayed image.
  // Replaces three separate helpers that each duplicated the foundKey lookup.
  const currentAnnotation = createMemo(() => {
    const img = displayedImage()
    const currentAnnotations = viewerAnnotations()
    if (!img) return null
    if (currentAnnotations.images[img.key]) return currentAnnotations.images[img.key]
    const foundKey = findAnnotationKey(
      img,
      currentAnnotations.images,
      currentAnnotations.lookupById,
      currentAnnotations.lookupByName,
    )
    return foundKey ? currentAnnotations.images[foundKey] : null
  })

  const getAnnotationViewBox = (img) => {
    const ann = currentAnnotation()
    if (ann && ann.width && ann.height) {
      return `0 0 ${ann.width} ${ann.height}`
    }
    return img && img.width && img.height ? `0 0 ${img.width} ${img.height}` : undefined
  }

  const getBoxes = () => {
    const ann = currentAnnotation()
    return {
      boxes: ann?.boxes || [],
      labels: viewerAnnotations().labels,
    }
  }

  const getAnnotationIdText = () => {
    const ann = currentAnnotation()
    return ann ? `ID: ${ann.id}` : 'No ID'
  }

  const imageLoadState = createMemo(() => {
    paintRevision()
    if (!activeImage()) return 'empty'

    const url = extractedUrls()[viewerIndex()]
    if (!url) return 'loading'

    const activeUrl = activeBuffer() === 1 ? image1Url() : image2Url()
    return activeUrl === url && paintedUrls.has(url) ? 'ready' : 'loading'
  })

  return (
    <main class="viewer-shell viewer-shell-contained" data-frame-id={currentAnnotation()?.id}>
      <Show when={imageError()}>
        <div class="viewer-error" role="alert">{imageError()}<button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div>
      </Show>
      <section class="viewer-panel">
        <Show
          when={activeImage()}
          fallback={
            <div class="empty-gallery">
              <h3>Tab preview chưa có dữ liệu ảnh</h3>
              <p>Quay lại tab chính và bấm vào một ảnh để nạp danh sách vào đây.</p>
            </div>
          }
        >
          {(img) => (
            <>
              <div class="viewer-toolbar" aria-label="Thanh công cụ xem ảnh">
                <div class="viewer-toolbar-leading">
                  <div class="viewer-nav-controls" aria-label="Điều hướng ảnh">
                    <button
                      type="button"
                      class="viewer-icon-btn"
                      onClick={goToPreviousImage}
                      disabled={viewerIndex() <= 0}
                      aria-label="Ảnh trước"
                      title="Ảnh trước (←)"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>
                    <span class="viewer-counter" aria-live="polite">
                      {viewerIndex() + 1} <span aria-hidden="true">/</span> {viewerImages().length}
                    </span>
                    <button
                      type="button"
                      class="viewer-icon-btn"
                      onClick={goToNextImage}
                      disabled={viewerIndex() >= viewerImages().length - 1}
                      aria-label="Ảnh tiếp theo"
                      title="Ảnh tiếp theo (→)"
                    >
                      <span aria-hidden="true">›</span>
                    </button>
                  </div>
                  <div class="viewer-title-block">
                    <strong class="viewer-frame-title">Frame {displayedFrameName()}</strong>
                    <span class="viewer-filename" title={displayedImage()?.name}>{displayedFileName()}</span>
                  </div>
                </div>

                <div class="viewer-toolbar-actions">
                  <span
                    class={`viewer-load-status viewer-load-status-${imageLoadState()}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span class="viewer-status-dot" aria-hidden="true" />
                    {imageLoadState() === 'ready' ? 'Sẵn sàng' : 'Đang tải ảnh…'}
                  </span>
                  <div class="viewer-zoom-controls" role="group" aria-label="Thu phóng">
                    <button
                      type="button"
                      class="viewer-tool-btn"
                      onClick={() => zoomViewerBy(0.85)}
                      aria-label="Thu nhỏ"
                      title="Thu nhỏ"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      class="viewer-zoom-value"
                      onClick={resetViewerZoom}
                      title="Đưa ảnh về vừa khung"
                      aria-label="Đưa ảnh về vừa khung"
                    >
                      {Math.round(viewerTx().scale * 100)}%
                    </button>
                    <button
                      type="button"
                      class="viewer-tool-btn"
                      onClick={() => zoomViewerBy(1.15)}
                      aria-label="Phóng to"
                      title="Phóng to"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    class="viewer-fit-btn"
                    onClick={resetViewerZoom}
                    title="Vừa khung (double click trên ảnh)"
                  >
                    Vừa khung
                  </button>
                  <button
                    class={`box-toggle-btn ${showBoxes() ? 'active' : ''}`}
                    onClick={() => setShowBoxes(!showBoxes())}
                    title={showBoxes() ? 'Ẩn các box annotation' : 'Hiện các box annotation'}
                    aria-pressed={showBoxes()}
                  >
                    {showBoxes() ? 'Hide Boxes' : 'Show Boxes'}
                  </button>
                </div>
              </div>

              <div
                ref={handleStageRef}
                class="viewer-stage"
                role="img"
                tabindex="0"
                aria-busy={imageLoadState() === 'loading'}
                aria-label={`Xem ảnh ${displayedImage()?.name || ''}. Dùng mũi tên trái và phải để chuyển ảnh.`}
                style={{ cursor: viewerTx().scale > 1 ? 'grab' : 'default' }}
                onMouseDown={handleViewerMouseDown}
                onMouseMove={handleViewerMouseMove}
                onMouseUp={handleViewerMouseUp}
                onMouseLeave={handleViewerMouseUp}
                onDblClick={handleViewerDoubleClick}
                onTouchStart={handleViewerTouchStart}
                onTouchMove={handleViewerTouchMove}
                onTouchEnd={handleViewerTouchEnd}
                onTouchCancel={handleViewerTouchEnd}
              >
                <div
                  class="viewer-image-container"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: `translate(${viewerTx().panX}px, ${viewerTx().panY}px) scale(${viewerTx().scale})`,
                    'transform-origin': '0 0',
                    width: displayedImage()?.width ? `${displayedImage().width}px` : 'auto',
                    height: displayedImage()?.height ? `${displayedImage().height}px` : 'auto',
                  }}
                >
                  <img
                    src={image1Url()}
                    alt={activeBuffer() === 1 ? displayedImage()?.name || '' : ''}
                    aria-hidden={activeBuffer() !== 1}
                    decoding="async"
                    draggable="false"
                    fetchpriority={activeBuffer() === 1 ? 'high' : 'low'}
                    onLoad={(e) => {
                      handleViewerImageLoad(e)
                      prePaintBuffer(1, e.currentTarget.src)
                    }}
                    class="viewer-image"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 1,
                      'z-index': activeBuffer() === 1 ? 2 : 1,
                      'pointer-events': activeBuffer() === 1 ? 'auto' : 'none',
                      display: image1Url() ? 'block' : 'none',
                    }}
                  />
                  <img
                    src={image2Url()}
                    alt={activeBuffer() === 2 ? displayedImage()?.name || '' : ''}
                    aria-hidden={activeBuffer() !== 2}
                    decoding="async"
                    draggable="false"
                    fetchpriority={activeBuffer() === 2 ? 'high' : 'low'}
                    onLoad={(e) => {
                      handleViewerImageLoad(e)
                      prePaintBuffer(2, e.currentTarget.src)
                    }}
                    class="viewer-image"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 1,
                      'z-index': activeBuffer() === 2 ? 2 : 1,
                      'pointer-events': activeBuffer() === 2 ? 'auto' : 'none',
                      display: image2Url() ? 'block' : 'none',
                    }}
                  />
                  <Show when={showBoxes()}>
                    <svg
                      class="viewer-annotations"
                      viewBox={getAnnotationViewBox(displayedImage())}
                      style={{
                        position: 'absolute',
                        'z-index': 3,
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        'pointer-events': 'none',
                      }}
                    >
                      {(() => {
                        const data = getBoxes()
                        return (
                          <For each={data.boxes}>
                            {(box) => {
                              const labelColor = data.labels[box.label] || '#ff0000'
                              return (
                                <g>
                                  <rect
                                    x={box.xtl}
                                    y={box.ytl}
                                    width={box.xbr - box.xtl}
                                    height={box.ybr - box.ytl}
                                    fill="transparent"
                                    stroke={labelColor}
                                    stroke-width={2 / viewerTx().scale}
                                  />
                                  <text
                                    x={box.xtl}
                                    y={box.ytl - 2 / viewerTx().scale}
                                    fill="#ffffff"
                                    style={{
                                      'font-size': `${12 / viewerTx().scale}px`,
                                      'font-weight': 'bold',
                                      'paint-order': 'stroke',
                                      stroke: labelColor,
                                      'stroke-width': `${3 / viewerTx().scale}px`,
                                      'dominant-baseline': 'text-after-edge',
                                    }}
                                  >
                                    {box.label}
                                  </text>
                                </g>
                              )
                            }}
                          </For>
                        )
                      })()}
                    </svg>
                  </Show>
                </div>
                <Show when={imageLoadState() === 'loading'}>
                  <div class="viewer-loading" role="status" aria-live="polite">
                    <span class="loading-spinner loading-spinner-small" aria-hidden="true" />
                    <span>Đang tải Frame {activeImage()?.frameId ?? viewerIndex() + 1}…</span>
                  </div>
                </Show>
              </div>

              <div class="viewer-meta">
                <div class="viewer-meta-content">
                  <input
                    ref={searchInput}
                    type="text"
                    value={searchQuery()}
                    onInput={(e) => {
                      const query = e.target.value.trim()
                      setSearchQuery(query)
                      if (!query) return

                      const displayList = viewerImages()
                      const currentAnns = viewerAnnotations()
                      let foundIndex = -1

                      const isNumeric = /^\d+$/.test(query)
                      if (isNumeric) {
                        foundIndex = displayList.findIndex(item => String(item.frameId) === query)
                        const foundKey = Object.keys(currentAnns.images).find((k) => {
                          const ann = currentAnns.images[k]
                          return ann && ann.id !== null && ann.id.toString() === query
                        })

                        if (foundKey && foundIndex < 0) {
                          const cleanKey = foundKey.toLowerCase().split('/').pop()
                          foundIndex = displayList.findIndex((item) => {
                            const imgName = item.name.toLowerCase()
                            return imgName === foundKey.toLowerCase() || imgName.endsWith(cleanKey)
                          })
                        }
                      }

                      if (foundIndex === -1) {
                        foundIndex = displayList.findIndex((item) =>
                          item.name.toLowerCase().includes(query.toLowerCase()),
                        )
                      }

                      if (foundIndex !== -1 && foundIndex !== viewerIndex()) {
                        setViewerIndex(foundIndex)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.target.blur()
                      }
                    }}
                    onFocus={() => setSearchQuery('')}
                    onBlur={() => {
                      setSearchQuery('')
                    }}
                    class="viewer-search-input"
                    aria-label="Tìm kiếm ảnh theo tên hoặc ID annotation"
                    placeholder="Dán hoặc nhập tên ảnh để tìm..."
                    title="Tìm kiếm tên ảnh"
                  />
                </div>
              </div>
            </>
          )}
        </Show>
      </section>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
