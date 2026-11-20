import { render } from 'solid-js/web'
import ViewerPage from './pages/ViewerPage'
import css from './styles.css?inline'

export function mountViewer(host, source, translate = text => text) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
  shadow.replaceChildren()
  const style = document.createElement('style')
  style.textContent = css.replace(':root', ':host') + `
    :host {
      display: block;
      min-height: 0;
      overflow: hidden;
      font-family: var(--font-sans, 'Inter', 'Segoe UI', sans-serif);
      color: var(--text-primary, #f1f5f9);
      background: var(--bg-viewport, #070a10);
      --accent: var(--accent-primary, #3b82f6);
      --accent2: var(--accent-primary-hover, #60a5fa);
      --success: var(--status-success, #10b981);
    }
    .viewer-shell { flex-direction: column; min-height: 0; height: 100%; overflow: hidden; background: var(--bg-viewport, #070a10); }
    .viewer-panel { flex: 1 1 0; height: auto; min-height: 0; background: var(--bg-surface, #121824); backdrop-filter: none; }
    .viewer-error { padding: 8px 14px; color: var(--status-danger-text, #fda4af); background: var(--status-danger-subtle, rgba(244,63,94,0.16)); border-bottom: 1px solid var(--status-danger-border, rgba(244,63,94,0.4)); font-size: 12px; }
    .viewer-error button { margin-left: 10px; padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-strong, #33415c); background: var(--bg-surface, #121824); color: var(--text-primary, #f1f5f9); font-size: 11px; font-weight: 600; }
    .viewer-toolbar { min-height: 36px; height: 38px; padding: 2px 10px; gap: 10px; box-shadow: none; background: var(--bg-surface-elevated, #171f2e); border-bottom: 1px solid var(--border-subtle, #222c3f); }
    .viewer-eyebrow { display: none; }
    .viewer-toolbar-leading { flex: 1; gap: 10px; }
    .viewer-title-block { flex: 1; }
    .viewer-title-block strong { max-width: none; font-size: 12px; color: var(--text-primary, #f1f5f9); font-family: var(--font-mono, monospace); }
    .viewer-filename { color: var(--text-secondary, #94a3b8); font-size: 11px; }
    .viewer-nav-controls, .viewer-zoom-controls { padding: 2px; gap: 2px; border-radius: 7px; border: 1px solid var(--border-subtle, #222c3f); background: var(--bg-surface, #121824); }
    .viewer-icon-btn { width: 24px; height: 24px; font-size: 18px; color: var(--text-primary, #f1f5f9); }
    .viewer-counter { min-width: 62px; font-size: 11px; color: var(--text-secondary, #94a3b8); font-variant-numeric: tabular-nums; }
    .viewer-toolbar-actions { gap: 6px; }
    .viewer-tool-btn, .viewer-zoom-value { min-width: 24px; height: 24px; font-size: 11px; color: var(--text-primary, #f1f5f9); }
    .viewer-zoom-value { min-width: 44px; color: var(--text-secondary, #94a3b8); }
    .viewer-icon-btn:hover:not(:disabled), .viewer-tool-btn:hover, .viewer-zoom-value:hover, .viewer-fit-btn:hover { border-color: var(--accent-border, rgba(59,130,246,0.4)); background: var(--accent-subtle, rgba(59,130,246,0.14)); color: var(--accent-text, #93c5fd); }
    .viewer-fit-btn { min-height: 28px; padding: 2px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-strong, #33415c); background: var(--bg-surface, #121824); color: var(--text-primary, #f1f5f9); }
    .viewer-load-status { padding: 3px 8px; font-size: 11px; font-weight: 500; border-color: var(--status-warning-border, rgba(245,158,11,0.36)); background: var(--status-warning-subtle, rgba(245,158,11,0.14)); color: var(--status-warning-text, #fcd34d); }
    .viewer-load-status-ready { border-color: var(--status-success-border, rgba(16,185,129,0.34)); background: var(--status-success-subtle, rgba(16,185,129,0.14)); color: var(--status-success-text, #6ee7b7); }
    .viewer-stage { background: var(--bg-viewport, #070a10); }
    .viewer-meta { display: flex; padding: 3px 10px; min-height: 30px; height: 34px; gap: 8px; background: var(--bg-surface-elevated, #171f2e); border-top: 1px solid var(--border-subtle, #222c3f); }
    .viewer-meta-content { flex: 1; min-width: 0; display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; }
    .viewer-current-name { flex: 0 1 auto; max-width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
    .viewer-search-input { min-width: 0; min-height: 24px; height: 24px; padding: 2px 8px; font-size: 11.5px; border-radius: 6px; border: 1px solid var(--border-strong, #33415c); background: var(--bg-input, #0d131f); color: var(--text-primary, #f1f5f9); }
    .viewer-search-input::placeholder { color: var(--text-muted, #64748b); }
    .viewer-search-input:focus { border-color: var(--border-focus, #3b82f6); background: var(--bg-input, #0d131f); box-shadow: 0 0 0 3px var(--accent-subtle, rgba(59,130,246,0.14)); }
    .viewer-toolbar .box-toggle-btn { height: 28px; padding: 2px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-strong, #33415c); background: var(--bg-surface, #121824); color: var(--text-primary, #f1f5f9); }
    .viewer-toolbar .box-toggle-btn.active { border-color: var(--accent-primary, #3b82f6); background: var(--accent-primary, #3b82f6); color: #ffffff; }
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
