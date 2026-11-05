// Benchmark the original ImageView build using its original BroadcastChannel transport.
// Build D:\Box\views into build/imageview-baseline before running this script.
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.resolve(__dirname, '..', 'build', 'imageview-smoke');

(async () => {
  app.setPath('userData', await fs.mkdtemp(path.join(os.tmpdir(), 'imageview-baseline-')));
  await app.whenReady();
  const file = path.resolve(__dirname, '..', 'build', 'imageview-baseline', 'index.html');
  const source = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  await source.loadFile(file);
  const images = Array.from({ length: 4990 }, (_, index) => ({ id: String(4999 - index), name: `camera/${String(index + 1).padStart(5, '0')}.png`, width: 320, height: 240, url: '' }));
  const pixels = Buffer.alloc(320 * 240 * 4, 100);
  const png = nativeImage.createFromBitmap(pixels, { width: 320, height: 240 }).toPNG().toString('base64');
  await source.webContents.executeJavaScript(`(() => {
    localStorage.setItem('local-image-viewer-state', JSON.stringify({images:${JSON.stringify(images)}}));
    const blob=new Blob([Uint8Array.from(atob(${JSON.stringify(png)}),c=>c.charCodeAt(0))],{type:'image/png'});
    window.fixtureChannel=new BroadcastChannel('image-view-channel');
    window.fixtureChannel.onmessage=({data})=>{ if(data.type==='REQ_IMG')window.fixtureChannel.postMessage({type:'RES_IMG',idx:data.idx,name:data.name,blob}); };
  })()`);
  const viewer = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { backgroundThrottling: false } });
  viewer.showInactive();
  await viewer.loadFile(file, { query: { viewer: '1', index: '0' } });
  const deadline = Date.now() + 20000;
  while (!await viewer.webContents.executeJavaScript(`!!document.querySelector('.viewer-load-status-ready')`)) {
    if (Date.now() > deadline) throw new Error('Baseline did not load');
    await delay(20);
  }
  await delay(500);
  const timings = await viewer.webContents.executeJavaScript(`(async () => {
    const s=document; const timings=[]; let blanks=0; let mismatches=0;
    for(let round=0;round<20;round++) for(const direction of [1,-1]) for(let step=0;step<10;step++) {
      const previous=Number(s.querySelector('.viewer-counter').textContent.split('/')[0]);const target=previous+direction;
      const started=performance.now();
      s.querySelector(direction>0?'button[aria-label="Ảnh tiếp theo"]':'button[aria-label="Ảnh trước"]').click();
      await new Promise((resolve,reject)=>{const deadline=performance.now()+5000;function check(){
        const visible=s.querySelector('img[aria-hidden="false"]');if(!visible?.complete||!visible?.naturalWidth)blanks++;
        if(s.querySelector('.viewer-load-status-ready')) { if(s.querySelector('.viewer-title-block strong').textContent!=='camera/'+String(target).padStart(5,'0')+'.png')mismatches++;timings.push(performance.now()-started);resolve(); }
        else if(performance.now()>deadline)reject(new Error('Navigation timeout'));else requestAnimationFrame(check);
      }requestAnimationFrame(check);});
    }
    timings.sort((a,b)=>a-b);return {transitions:timings.length,p50:timings[Math.floor(timings.length*.5)],p95:timings[Math.floor(timings.length*.95)],blanks,mismatches};
  })()`);
  assert.equal(timings.blanks, 0); assert.equal(timings.mismatches, 0);
  const desktop = JSON.parse(await fs.readFile(path.join(output, 'report.json'), 'utf8'));
  const report = { baselineCommit: 'bedc1e2a130a68808d1a58a77a2ed809a168c8ad', dimensions: '320x240', baseline: timings,
    desktop: { transitions: desktop.transitions, p50: desktop.p50, p95: desktop.p95, blanks: desktop.blanks, mismatches: desktop.mismatches },
    note: 'Original web viewer through BroadcastChannel vs integrated viewer through fixture HTTP + Electron IPC; same Electron runtime, small decoded images. Not a high-resolution or 30-minute endurance benchmark.' };
  await fs.writeFile(path.join(output, 'comparison.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  BrowserWindow.getAllWindows().forEach(win => win.destroy()); app.exit(0);
})().catch(error => { console.error(error.stack); app.exit(1); });
