// Run after npm run desktop:build. Uses a temporary profile and a local CVAT fixture.
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');

let server;
let profile;
let window;
const output = path.resolve(__dirname, '..', 'build', 'imageview-smoke');
const errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const js = code => window.webContents.executeJavaScript(code, true);
async function until(code, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await js(code)) return; await delay(20); }
  throw new Error(`Timed out: ${label}`);
}
async function button(text) {
  const clicked = await js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); b?.click(); return !!b; })()`);
  assert(clicked, `Button: ${text}`);
}
async function fill(selector, value) {
  await js(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
}

(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cvat-imageview-smoke-'));
  app.setPath('userData', profile);
  await fs.mkdir(output, { recursive: true });
  const cacheCheck = process.argv.includes('--cache-check');
  const count = cacheCheck ? 48 : 5000;
  const frames = Array.from({ length: count }, (_, frame) => ({ name: `camera/${String(count - frame).padStart(5, '0')}.png`, width: 320, height: 240 }));
  let failFrame = -1;
  const requests = [];
  let annotationReads = 0;
  const images = new Map();
  let concurrent = 0;
  let maxConcurrent = 0;
  function image(frame) {
    const color = frame % 8;
    if (!images.has(color)) {
      const pixels = Buffer.alloc(320 * 240 * 4);
      for (let i = 0; i < pixels.length; i += 4) { pixels[i] = color * 25; pixels[i + 1] = 60; pixels[i + 2] = 220 - color * 20; pixels[i + 3] = 255; }
      images.set(color, nativeImage.createFromBitmap(pixels, { width: 320, height: 240 }).toPNG());
    }
    return images.get(color);
  }
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer imageview-fixture-token') { res.writeHead(403); res.end('{}'); return; }
    const meta = { frames, start_frame: 100, stop_frame: 100 + (count - 1) * 2, frame_filter: 'step=2', size: count, deleted_frames: [] };
    const task = { id: 10, name: 'ImageView 5000-frame fixture', size: count, mode: 'annotation', updated_date: 'fixture-r1' };
    const job = { id: 20, task_id: 10, start_frame: 10, stop_frame: count - 1 };
    let data;
    if (url.pathname === '/api/tasks') data = { results: [task] };
    else if (url.pathname === '/api/jobs') data = { results: [job] };
    else if (url.pathname === '/api/tasks/10') data = task;
    else if (url.pathname === '/api/jobs/20') data = job;
    else if (url.pathname === '/api/tasks/10/data/meta') data = meta;
    else if (url.pathname === '/api/jobs/20/data/meta') data = { ...meta, frames: frames.slice(10), start_frame: 120 };
    else if (url.pathname === '/api/labels') data = { results: [{ id: 1, name: 'car', color: '#00ff00' }] };
    else if (/\/annotations$/.test(url.pathname)) { annotationReads++; data = { shapes: frames.map((_, frame) => ({ id: frame + 1, frame, type: 'rectangle', label_id: 1, points: [frame % 100, 20, 150, 120] })), tracks: [] }; }
    else if (/\/(jobs\/20|tasks\/10)\/data$/.test(url.pathname)) {
      const frame = Number(url.searchParams.get('number'));
      requests.push(frame); concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(frame === failFrame ? 100 : 8);
      concurrent--;
      if (frame === failFrame) { res.writeHead(503); res.end('{}'); return; }
      res.setHeader('Content-Type', 'image/png'); res.end(image(frame)); return;
    } else { res.writeHead(404); res.end('{}'); return; }
    res.end(JSON.stringify(data));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  app.on('browser-window-created', (_event, win) => {
    window = win;
    win.show = () => win.showInactive();
    win.webContents.setBackgroundThrottling(false);
    win.webContents.on('console-message', (_event, ...args) => {
      const message = typeof args[0] === 'object' ? args[0].message : args[1];
      if (message && /Uncaught|Error:/.test(message)) errors.push(message);
    });
  });
  delete process.env.ELECTRON_RENDERER_URL;
  require('./main.cjs');
  ipcMain.removeHandler('cvat:token:has-default'); ipcMain.handle('cvat:token:has-default', () => false);
  await app.whenReady();
  while (!window) await delay(20);
  await until(`!!document.querySelector('.project-sidebar')`, 'app');
  await js(`window.cvatDesktop.saveToken('imageview-fixture-token', ${JSON.stringify(base)})`);
  await js(`window.cvatDesktop.saveToken('other-server-fixture-token', 'http://other.invalid')`);
  assert.equal(await js(`window.cvatDesktop.getStoredToken(${JSON.stringify(base)})`), 'imageview-fixture-token');
  assert.equal(await js(`window.cvatDesktop.getStoredToken('http://other.invalid')`), 'other-server-fixture-token');
  for (const file of await fs.readdir(profile)) if (/^cvat-pat-.*\.bin$/.test(file)) {
    assert(!(await fs.readFile(path.join(profile, file))).includes(Buffer.from('fixture-token')));
  }
  await button('Settings');
  await until(`!!document.querySelector('#app-language')`, 'language settings');
  await js(`(() => { const input=document.querySelector('#app-language'); input.value='vi'; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(`document.documentElement.lang==='vi'`, 'Vietnamese locale');
  await js(`document.querySelector('.project-sidebar button:not(.sidebar-toggle)').click()`);
  assert.equal(await js(`document.querySelectorAll('.project-sidebar button:not(.sidebar-toggle)').length`), 2);
  await until(`!!document.querySelector('[data-testid="shared-source"] input[autocomplete="url"]')`, 'shared connection');
  await fill('[data-testid="shared-source"] input[autocomplete="url"]', base);
  await fill('[data-testid="shared-source"] input[type="password"]', 'imageview-fixture-token');
  // The source picker belongs to Home and is shared by all three tools.
  await js(`document.querySelector('[data-testid="shared-source"] button').focus()`);
  await js(`([...document.querySelectorAll('[data-testid="shared-source"] button')].find(b=>b.textContent.trim()==='Lấy danh sách Task')).click()`);
  await until(`!!document.querySelector('[data-testid="shared-source"] option[value="20"]')`, 'fixture Job list');
  await js(`([...document.querySelectorAll('[data-testid="shared-source"] button')].find(b=>b.textContent.trim()==='Mở Job')).click()`);
  await until(`[...document.querySelectorAll('.project-sidebar button')].some(b=>b.textContent.trim()==='ImageView')`, 'three shared tools');
  if (cacheCheck) {
    await until(`document.querySelector('[data-testid="job-image-cache"]')?.dataset.state==='complete'`, 'automatic full Job cache');
    assert.equal(await js(`!!document.querySelector('[data-testid="imageview-host"]')`), false, 'Caching must start before opening ImageView');
  }
  await button('ImageView');
  await until(`document.querySelector('[data-testid="imageview-host"]')?.shadowRoot?.querySelector('.viewer-load-status-ready')`, 'first frame');
  const read = () => js(`(() => { const s=document.querySelector('[data-testid="imageview-host"]').shadowRoot; return {name:s.querySelector('.viewer-title-block strong').textContent, id:s.querySelector('.viewer-shell').dataset.frameId, ready:!!s.querySelector('.viewer-load-status-ready'), counter:s.querySelector('.viewer-counter').textContent}; })()`);
  if (cacheCheck) {
    const downloads = requests.length;
    assert.equal(new Set(requests).size, count - 10);
    assert.equal(downloads, count - 10, 'Each Job image should be downloaded once');
    await button('Đóng Job');
    await button('Mở Job');
    await until(`[...document.querySelectorAll('.project-sidebar button')].some(b=>b.textContent.trim()==='ImageView')`, 'reopened shared Job');
    await button('ImageView');
    await until(`!!document.querySelector('[data-testid="imageview-host"]')?.shadowRoot?.querySelector('.viewer-load-status-ready')`, 'reopened cached frame');
    await until(`document.querySelector('[data-testid="job-image-cache"]')?.dataset.state==='complete'`, 'reopened cached Job');
    assert.equal(requests.length, downloads, 'Reopen must not download image bytes again');
    const report = { jobImages: count - 10, imageDownloads: downloads, imageDownloadsOnReopen: requests.length - downloads, automaticBeforeImageView: true, maximumNetworkConcurrency: maxConcurrent };
    await fs.writeFile(path.join(output, 'auto-cache.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    BrowserWindow.getAllWindows().forEach(win => win.destroy()); server.close(); app.exit(0); return;
  }
  assert.equal((await read()).name, 'camera/00001.png');
  const layout = await js(`(() => { const bar=document.querySelector('.app-file-bar'); const host=document.querySelector('[data-testid="imageview-host"]'); return {barHeight:bar.getBoundingClientRect().height,previewHeight:host.getBoundingClientRect().height,previewBottom:host.getBoundingClientRect().bottom,viewportHeight:innerHeight}; })()`);
  assert.equal(await js(`document.querySelector('.project-sidebar').getBoundingClientRect().width`), 56);
  await js(`document.querySelector('.sidebar-toggle').click()`);
  await until(`document.querySelector('.project-sidebar').getBoundingClientRect().width===190`, 'expand sidebar');
  await js(`document.querySelector('.sidebar-toggle').click()`);
  await until(`document.querySelector('.project-sidebar').getBoundingClientRect().width===56`, 'collapse sidebar');
  assert(layout.barHeight <= 44, `Source bar too tall: ${layout.barHeight}`);
  assert(layout.previewBottom <= layout.viewportHeight, 'Preview must fit the viewport');
  const viewerBars = await js(`(() => {const s=document.querySelector('[data-testid="imageview-host"]').shadowRoot;return {toolbar:s.querySelector('.viewer-toolbar').getBoundingClientRect().height,footer:s.querySelector('.viewer-meta').getBoundingClientRect().height,footerInputs:s.querySelectorAll('.viewer-meta input').length,footerButtons:s.querySelectorAll('.viewer-meta button').length};})()`);
  assert(viewerBars.toolbar <= 40, `Viewer toolbar too tall: ${viewerBars.toolbar}`);
  assert(viewerBars.footer <= 36, `Viewer footer too tall: ${viewerBars.footer}`);
  assert.equal(viewerBars.footerInputs, 1); assert.equal(viewerBars.footerButtons, 0);
  const viewportChecks = [];
  for (const [width, height, zoom] of [[1440, 900, 1], [1280, 720, 1], [1920, 1080, 1], [1280, 720, 1.25], [1440, 900, 1.5]]) {
    window.setSize(width, height);
    window.webContents.setZoomFactor(zoom);
    await delay(150);
    const check = await js(`(() => {
      const s=document.querySelector('[data-testid="imageview-host"]').shadowRoot;
      const footer=s.querySelector('.viewer-meta').getBoundingClientRect();
      const input=s.querySelector('input').getBoundingClientRect();
      const stage=s.querySelector('.viewer-stage').getBoundingClientRect();
      window.scrollTo(10000,10000);
      return {viewport:[innerWidth,innerHeight],page:[document.scrollingElement.scrollWidth,document.scrollingElement.scrollHeight],scroll:[scrollX,scrollY],footerBottom:footer.bottom,inputBottom:input.bottom,stageHeight:stage.height};
    })()`);
    assert(check.page[1] <= check.viewport[1] + 1 && check.page[0] <= check.viewport[0] + 1, `Page overflow at ${width}x${height} zoom ${zoom}: ${JSON.stringify(check)}`);
    assert.deepEqual(check.scroll, [0, 0]);
    assert(check.footerBottom <= check.viewport[1] + 1 && check.inputBottom <= check.viewport[1] + 1 && check.stageHeight > 100, 'Image and search must remain visible');
    viewportChecks.push({ width, height, zoom, ...check });
  }
  window.webContents.setZoomFactor(1); window.setSize(1440, 900);
  await delay(150);
  assert.equal(annotationReads, 1, 'ImageView must reuse the shared annotation snapshot');
  assert.match((await read()).id, /4999/);
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.box-toggle-btn').click()`);
  assert.equal(await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('svg rect').getAttribute('x')`), '99');
  await delay(500);
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-stage').focus()`);
  const timings = await js(`(async () => {
    const s=document.querySelector('[data-testid="imageview-host"]').shadowRoot;
    const timings=[]; let blanks=0; let mismatches=0;
    for(let round=0;round<20;round++) for(const direction of [1,-1]) for(let step=0;step<10;step++) {
      const previous=Number(s.querySelector('.viewer-counter').textContent.split('/')[0]);
      const target=previous+direction;
      const started=performance.now();
      s.querySelector(direction>0?'button[aria-label="Ảnh tiếp theo"]':'button[aria-label="Ảnh trước"]').click();
      await new Promise((resolve,reject)=>{ const deadline=performance.now()+5000; function check(){
        const visible=s.querySelector('img[aria-hidden="false"]');
        if(!visible?.complete || !visible?.naturalWidth) blanks++;
        if(s.querySelector('.viewer-load-status-ready')) {
          const name=s.querySelector('.viewer-title-block strong').textContent;
          if(name!== 'camera/'+String(target).padStart(5,'0')+'.png') mismatches++;
          timings.push(performance.now()-started); resolve();
        } else if(performance.now()>deadline) reject(new Error('Navigation timeout')); else requestAnimationFrame(check);
      } requestAnimationFrame(check); });
    }
    timings.sort((a,b)=>a-b); return {transitions:timings.length, p50:timings[Math.floor(timings.length*.5)], p95:timings[Math.floor(timings.length*.95)], blanks,mismatches};
  })()`);
  assert.equal(timings.blanks, 0); assert.equal(timings.mismatches, 0);
  console.log('Navigation:', JSON.stringify(timings));
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('button[aria-label="Phóng to"]').click()`);
  const zoom = await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-zoom-value').textContent`);
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('button[aria-label="Ảnh tiếp theo"]').click()`);
  await until(`!!document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-load-status-ready')`, 'zoom-preserving navigation');
  assert.equal(await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-zoom-value').textContent`), zoom);
  const beforeFailure = (await read()).name;
  failFrame = 100;
  await js(`(() => {const input=document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('input'); input.value='100'; input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));})()`);
  await until(`!!document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('[role="alert"]')`, 'frame failure');
  assert.equal((await read()).name, beforeFailure);
  failFrame = -1;
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-error button').click()`);
  await until(`!!document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-load-status-ready')`, 'frame retry');
  assert.equal((await read()).name, frames[100].name);
  await fs.writeFile(path.join(output, 'viewer.png'), (await window.webContents.capturePage()).toPNG());
  // Cache remains bounded and settings use the actual preload/main service.
  const cache = await js(`window.cvatDesktop.viewerCache({action:'info'})`);
  assert(cache.entries > 0 && cache.bytes < cache.limitGB * 1024 ** 3);
  assert(maxConcurrent <= 3, `Concurrency: ${maxConcurrent}`);
  await js(`document.querySelector('.project-sidebar button:last-child').click()`);
  await until(`!!document.querySelector('[aria-label="ImageView cache GB"]')`, 'cache settings');
  await button('ImageView');
  assert.equal((await read()).name, frames[100].name);
  await js(`window.previousViewerToolbar=document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-toolbar')`);
  await button('Tải lại Job');
  await until(`(() => { const s=document.querySelector('[data-testid="imageview-host"]')?.shadowRoot; return s?.querySelector('.viewer-toolbar')!==window.previousViewerToolbar && !!s?.querySelector('.viewer-load-status-ready'); })()`, 'shared reload');
  assert.equal(annotationReads, 2);
  assert.equal((await read()).name, frames[100].name);
  // The standalone ZIP worker and XML overlays use the same viewer and sort contract.
  await button('Đóng Job');
  assert.equal(await js(`document.querySelectorAll('.project-sidebar button:not(.sidebar-toggle)').length`), 2);
  const { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader, TextReader } = await import('@zip.js/zip.js');
  const zip = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false, level: 0 });
  const names = ['2.png', '10.png', '1.png', 'camera/a.png', 'camera2/a.png'];
  for (const [index, name] of names.entries()) await zip.add(name, new Uint8ArrayReader(image(index)));
  await zip.add('annotations.xml', new TextReader(`<annotations><meta><task><labels><label><name>car</name><color>#00ff00</color></label></labels></task></meta>${names.map((name,index)=>`<image id="${index}" name="${name}" width="320" height="240"><box label="car" xtl="1" ytl="2" xbr="100" ybr="120"/></image>`).join('')}</annotations>`));
  const archive = Buffer.from(await zip.close()).toString('base64');
  await js(`(() => { const input=document.querySelector('[data-testid="shared-source"] input[type="file"]'); const bytes=Uint8Array.from(atob(${JSON.stringify(archive)}),c=>c.charCodeAt(0)); Object.defineProperty(input,'files',{configurable:true,value:[new File([bytes],'fixture.zip',{type:'application/zip'})]}); input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(`[...document.querySelectorAll('.project-sidebar button')].some(b=>b.textContent.trim()==='ImageView')`, 'shared ZIP dataset');
  await button('ImageView');
  await until(`!!document.querySelector('[data-testid="imageview-host"]')?.shadowRoot?.querySelector('.viewer-load-status-ready')`, 'ZIP worker');
  assert.equal(await js(`document.querySelector('[aria-label="ImageView"]').querySelectorAll('input[type="file"], select').length`), 0);
  assert.equal((await read()).name, '1.png');
  await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('button[aria-label="Ảnh tiếp theo"]').click()`);
  await until(`!!document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-load-status-ready')`, 'ZIP next');
  assert.equal((await read()).name, '10.png');
  await fs.writeFile(path.join(output, 'zip-viewer.png'), (await window.webContents.capturePage()).toPNG());
  assert.deepEqual(errors, []);
  const report = { datasetFrames: count, jobStart: 10, filenameOrder: 'localeCompare', layout, viewerBars, viewportChecks, ...timings, maxConcurrent, networkFrameRequests: requests.length, cache,
    checks: ['real production renderer/preload/main IPC', 'one Home picker shared by Box/ANPR/ImageView', 'encrypted PAT isolation per server', 'nonzero Job + source frame step', 'filename order and original frame IDs', '400 bidirectional transitions', 'no blank image or filename mismatch', 'zoom retained', 'failed target retains old image', 'retry', 'cache quota', 'tab switch preserves session', 'ZIP worker and XML', 'ZIP lexicographic order: 1,10,2'], errors };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  BrowserWindow.getAllWindows().forEach(win => win.destroy());
  server.close();
  app.exit(0);
})().catch(async error => {
  console.error(error.stack);
  if (window && !window.isDestroyed()) {
    console.error(await js(`document.body.innerText`).catch(() => 'Renderer unavailable'));
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'failure.png'), (await window.webContents.capturePage()).toPNG()).catch(() => {});
  }
  server?.close(); app.exit(1);
});
