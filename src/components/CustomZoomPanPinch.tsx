import React, { useState, useEffect, useRef } from 'react';

export interface ZoomState {
  scale: number;
}

interface CustomZoomPanPinchProps {
  children: (args: { state: ZoomState }) => React.ReactNode;
  contentWidth: number;
  contentHeight: number;
  onZoomToElementRef: React.MutableRefObject<any>;
}

interface Transform {
  scale: number;
  panX: number;
  panY: number;
}

function CustomZoomPanPinch({
  children,
  contentWidth,
  contentHeight,
  onZoomToElementRef
}: CustomZoomPanPinchProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const txRef = useRef<Transform>({ scale: 1, panX: 0, panY: 0 });
  const [tx, setTx] = useState<Transform>({ scale: 1, panX: 0, panY: 0 });
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);

  const MIN_ZOOM = 0.05;
  const MAX_ZOOM = 50;

  function constrainViewerPan(tx: Transform, stage: HTMLDivElement | null): Transform {
    if (!stage || !contentWidth || !contentHeight) return tx;
    const { scale, panX, panY } = tx;
    const bounds = stage.getBoundingClientRect();

    const imgWidth = contentWidth * scale;
    const imgHeight = contentHeight * scale;

    const maxPanX = imgWidth + bounds.width * 5;
    const maxPanY = imgHeight + bounds.height * 5;

    const constrainedPanX = Math.min(Math.max(panX, -maxPanX), maxPanX);
    const constrainedPanY = Math.min(Math.max(panY, -maxPanY), maxPanY);

    return { scale, panX: constrainedPanX, panY: constrainedPanY };
  }

  function paintTx(nextTx: Transform, animated = false, duration = 600) {
    const content = contentRef.current;
    if (!content) return;

    content.style.transition = animated
      ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : 'none';
    content.style.transform = `translate3d(${nextTx.panX}px, ${nextTx.panY}px, 0) scale(${nextTx.scale})`;
  }

  function schedulePaint() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      paintTx(txRef.current, false);
    });
  }

  function commitTx() {
    setTx({ ...txRef.current });
  }

  function scheduleCommit(delay = 120) {
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(commitTx, delay);
  }

  function updateTx(nextTx: Transform, animated = false, duration = 600) {
    if (!nextTx || isNaN(nextTx.scale) || isNaN(nextTx.panX) || isNaN(nextTx.panY)) {
      console.error('Invalid zoom Tx', nextTx);
      return;
    }
    const stage = stageRef.current;
    if (stage) {
      nextTx = constrainViewerPan(nextTx, stage);
    }

    txRef.current = nextTx;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    paintTx(nextTx, animated, duration);

    if (animated) {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      animTimeoutRef.current = setTimeout(commitTx, duration);
    } else {
      commitTx();
    }
  }

  useEffect(() => {
    if (onZoomToElementRef) {
      onZoomToElementRef.current = {
        zoomToElement: (elementId: string | HTMLElement, _padding = 0, duration = 800, _easing = 'easeOut') => {
          const el = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
          if (el && stageRef.current && contentWidth && contentHeight) {
            let x = 0, y = 0, width = 0, height = 0;

            // Try to read SVG attributes if available (much more reliable)
            if (el.hasAttribute('x') && el.hasAttribute('y') && el.hasAttribute('width') && el.hasAttribute('height')) {
              x = parseFloat(el.getAttribute('x') || '0');
              y = parseFloat(el.getAttribute('y') || '0');
              width = parseFloat(el.getAttribute('width') || '0');
              height = parseFloat(el.getAttribute('height') || '0');
            } else {
              // Fallback to bounding rect calculations
              const contentContainer = stageRef.current!.firstElementChild;
              if (!contentContainer) return;
              const contentRect = contentContainer.getBoundingClientRect();
              const elRect = el.getBoundingClientRect();

              const currentScale = txRef.current.scale;

              x = (elRect.left - contentRect.left) / currentScale;
              y = (elRect.top - contentRect.top) / currentScale;
              width = elRect.width / currentScale;
              height = elRect.height / currentScale;
            }

            if (width > 0 && height > 0) {
              const stageBounds = stageRef.current.getBoundingClientRect();

              // Add some visual padding around the zoomed element
              const paddedWidth = width + 50;
              const paddedHeight = height + 50;

              const scaleX = stageBounds.width / paddedWidth;
              const scaleY = stageBounds.height / paddedHeight;

              // Cap the maximum scale so it doesn't zoom in crazy much for tiny boxes
              const targetScale = Math.min(scaleX, scaleY, 5);
              const newScale = Math.min(Math.max(targetScale, MIN_ZOOM), MAX_ZOOM);

              const newPanX = stageBounds.width / 2 - (x + width / 2) * newScale;
              const newPanY = stageBounds.height / 2 - (y + height / 2) * newScale;

              updateTx({ scale: newScale, panX: newPanX, panY: newPanY }, true, duration);
            }
          }
        }
      };
    }
  }, [onZoomToElementRef, contentWidth, contentHeight]);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage && contentWidth && contentHeight) {
      const bounds = stage.getBoundingClientRect();
      const scaleX = bounds.width / contentWidth;
      const scaleY = bounds.height / contentHeight;
      const fitScale = Math.min(scaleX, scaleY, 1);

      const panX = (bounds.width - contentWidth * fitScale) / 2;
      const panY = (bounds.height - contentHeight * fitScale) / 2;

      updateTx({ scale: fitScale, panX, panY }, false);
    }
  }, [contentWidth, contentHeight]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onWheel(event: WheelEvent) {
      if (!stage) return;
      event.preventDefault();
      const { scale, panX, panY } = txRef.current;
      const bounds = stage.getBoundingClientRect();
      const cx = event.clientX - bounds.left;
      const cy = event.clientY - bounds.top;

      const ix = (cx - panX) / scale;
      const iy = (cy - panY) / scale;

      // Keep high-resolution trackpads smooth and prevent mouse-wheel jumps.
      const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1;
      const normalizedDelta = Math.max(-120, Math.min(120, event.deltaY * deltaMultiplier));
      const zoomFactor = Math.exp(-normalizedDelta * 0.0018);
      let newScale = scale * zoomFactor;
      newScale = Math.min(Math.max(newScale, MIN_ZOOM), MAX_ZOOM);

      const newPanX = cx - ix * newScale;
      const newPanY = cy - iy * newScale;

      txRef.current = constrainViewerPan({ scale: newScale, panX: newPanX, panY: newPanY }, stage);
      schedulePaint();
      scheduleCommit();
    }

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  function handleMouseDown(event: React.MouseEvent) {
    event.preventDefault();
    dragRef.current = { lastX: event.clientX, lastY: event.clientY };
    document.body.style.cursor = 'grabbing';
  }

  function handleMouseMove(event: React.MouseEvent) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;
    dragRef.current = { lastX: event.clientX, lastY: event.clientY };

    const { scale, panX, panY } = txRef.current;
    txRef.current = constrainViewerPan({ scale, panX: panX + dx, panY: panY + dy }, stageRef.current);
    schedulePaint();
  }

  function handleMouseUp() {
    if (dragRef.current) commitTx();
    dragRef.current = null;
    document.body.style.cursor = '';
  }

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
  }, []);

  function handleDoubleClick(_event: React.MouseEvent) {
    const stage = stageRef.current;
    if (stage && contentWidth && contentHeight) {
      const bounds = stage.getBoundingClientRect();
      const scaleX = bounds.width / contentWidth;
      const scaleY = bounds.height / contentHeight;
      const fitScale = Math.min(scaleX, scaleY, 1);

      const panX = (bounds.width - contentWidth * fitScale) / 2;
      const panY = (bounds.height - contentHeight * fitScale) / 2;

      updateTx({ scale: fitScale, panX, panY }, true);
    }
  }

  return (
    <div
      ref={stageRef}
      className="w-full h-full relative overflow-hidden"
      style={{ cursor: tx.scale > 1 ? 'grab' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div
        ref={contentRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          width: contentWidth ? `${contentWidth}px` : '100%',
          height: contentHeight ? `${contentHeight}px` : '100%',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        {children({ state: { scale: tx.scale } })}
      </div>
    </div>
  );
}

export default CustomZoomPanPinch;
