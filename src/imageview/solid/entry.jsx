import { render } from 'solid-js/web'
import ViewerPage from './pages/ViewerPage'
import css from './styles.css?inline'

export function mountViewer(host, source, translate = text => text) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
  shadow.replaceChildren()
  const style = document.createElement('style')
  style.textContent = css.replace(':root', ':host') + `
    :host { display: block; min-height: 0; overflow: hidden; }
    .viewer-shell { flex-direction: column; min-height: 0; height: 100%; overflow: hidden; }
    .viewer-panel { flex: 1 1 0; height: auto; min-height: 0; }
    .viewer-error { padding: 8px 16px; color: #fda4af; background: #401828; }
    .viewer-error button { margin-left: 12px; }
    .viewer-toolbar { min-height: 36px; padding: 3px 8px; gap: 8px; box-shadow: none; }
    .viewer-eyebrow { display: none; }
    .viewer-toolbar-leading { flex: 1; gap: 8px; }
    .viewer-title-block { flex: 1; }
    .viewer-title-block strong { max-width: none; font-size: 12px; }
    .viewer-nav-controls, .viewer-zoom-controls { padding: 0; gap: 0; border-radius: 6px; }
    .viewer-icon-btn { width: 24px; height: 24px; font-size: 20px; }
    .viewer-counter { min-width: 60px; font-size: 11px; }
    .viewer-toolbar-actions { gap: 6px; }
    .viewer-tool-btn, .viewer-zoom-value { min-width: 24px; height: 24px; font-size: 11px; }
    .viewer-zoom-value { min-width: 40px; }
    .viewer-fit-btn { min-height: 26px; padding: 2px 8px; font-size: 11px; }
    .viewer-load-status { padding: 3px 6px; font-size: 10px; }
    .viewer-meta { display: flex; padding: 3px 8px; min-height: 30px; gap: 8px; }
    .viewer-meta-content { flex: 1; min-width: 0; display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; }
    .viewer-current-name { flex: 0 1 auto; max-width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
    .viewer-search-input { min-width: 0; min-height: 24px; height: 24px; padding: 2px 6px; font-size: 11px; }
    .viewer-toolbar .box-toggle-btn { height: 26px; padding: 2px 6px; font-size: 10px; }
  `
  const element = document.createElement('div')
  element.style.height = '100%'
  shadow.append(style, element)
  const dispose = render(() => <ViewerPage source={source} initialRouteState={{ index: source.initialIndex || 0 }} />, element)
  const originals = new WeakMap()
  const localize = () => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const previous = originals.get(node)
      const original = previous && node.textContent === previous.translated ? previous.original : node.textContent
      const translated = translate(original)
      originals.set(node, { original, translated })
      if (node.textContent !== translated) node.textContent = translated
    }
  }
  const observer = new MutationObserver(localize)
  observer.observe(element, { subtree: true, childList: true, characterData: true })
  localize()
  return { dispose: () => { observer.disconnect(); dispose(); shadow.replaceChildren() } }
}
