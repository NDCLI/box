// Read-only smoke check against configured local CVAT servers. Never prints PATs.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
let window;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const js = code => window.webContents.executeJavaScript(code, true);
async function until(code, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) { if (await js(code)) return; await delay(50); }
  throw new Error(`Timed out: ${label}`);
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const tokens = Object.fromEntries((await fs.readFile(path.join(root, 'token.txt'), 'utf8')).split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).map(line => {
    const separator = line.indexOf('='); return [line.slice(0, separator).trim().replace(/\/+$/, ''), line.slice(separator + 1).trim()];
  }));
  const server = process.argv.find(value => /^https?:\/\//.test(value)) || Object.keys(tokens)[0];
  const token = tokens[server];
  if (!token) throw new Error('No configured token for selected server');
  const headers = { Authorization: `Bearer ${token}` };
  const taskResponse = await fetch(`${server}/api/tasks?page_size=1`, { headers, signal: AbortSignal.timeout(15000) });
  assert.equal(taskResponse.status, 200);
  const task = (await taskResponse.json()).results[0];
  const job = (await (await fetch(`${server}/api/jobs?task_id=${task.id}&page_size=1`, { headers })).json()).results[0];
  const meta = await (await fetch(`${server}/api/tasks/${task.id}/data/meta`, { headers })).json();
  const expected = meta.frames.map((frame, frameId) => ({ ...frame, frameId })).filter(frame => frame.frameId >= job.start_frame && frame.frameId <= job.stop_frame && !meta.deleted_frames.includes(frame.frameId)).sort((a, b) => a.name.localeCompare(b.name));
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'cvat-imageview-live-'));
  app.setPath('userData', profile);
  app.on('browser-window-created', (_event, win) => { window = win; win.show = () => win.showInactive(); win.webContents.setBackgroundThrottling(false); });
  delete process.env.ELECTRON_RENDERER_URL;
  require('./main.cjs');
  ipcMain.removeHandler('cvat:token:has-default'); ipcMain.handle('cvat:token:has-default', () => false);
  await app.whenReady();
  while (!window) await delay(20);
  await until(`!!document.querySelector('.project-sidebar')`, 'app');
  await js(`window.cvatDesktop.saveToken(${JSON.stringify(token)}, ${JSON.stringify(server)})`);
  await until(`!!document.querySelector('[data-testid="shared-source"] input[autocomplete="url"]')`, 'connection');
  // Use the normal form and pasted Job link. The panel resolves the Task from the Job.
  await js(`(() => { const scope=document.querySelector('[data-testid="shared-source"]'); const set=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}; set(scope.querySelector('input[autocomplete="url"]'),${JSON.stringify(server)}); set(scope.querySelector('input[type="password"]'),${JSON.stringify(token)}); const job=scope.querySelector('input[inputmode="text"]'); set(job,${JSON.stringify(`${server}/tasks/${task.id}/jobs/${job.id}`)}); })()`);
  await js(`([...document.querySelectorAll('[data-testid="shared-source"] button')].find(button=>/^(Open Job|Mở Job)$/.test(button.textContent.trim()))).click()`);
  await until(`[...document.querySelectorAll('.project-sidebar button')].some(b=>b.textContent.trim()==='ImageView')`, 'shared data loaded');
  await js(`([...document.querySelectorAll('.project-sidebar button')].find(button=>button.textContent.trim()==='ImageView')).click()`);
  await until(`!!document.querySelector('[data-testid="imageview-host"]')?.shadowRoot?.querySelector('.viewer-load-status-ready')`, 'live image');
  const names = [];
  const transitions = Math.min(15, expected.length);
  for (let index = 0; index < transitions; index++) {
    const name = await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-title-block strong').textContent`);
    assert.equal(name, expected[index].name); names.push(name);
    const id = await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-shell').dataset.frameId`);
    assert(id.includes(String(expected[index].frameId)));
    if (index + 1 < transitions) {
      await js(`document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('button[aria-label="Ảnh tiếp theo"]').click()`);
      await until(`!!document.querySelector('[data-testid="imageview-host"]').shadowRoot.querySelector('.viewer-load-status-ready')`, 'live next image');
    }
  }
  const result = { server, taskId: task.id, jobId: job.id, jobStart: job.start_frame, jobStop: job.stop_frame, imagesInJob: expected.length, imagesVerified: names.length, filenameOrderAndFrameIds: true, cache: await js(`window.cvatDesktop.viewerCache({action:'info'})`) };
  const output = path.join(root, 'build', 'imageview-smoke');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, `live-${new URL(server).hostname}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  BrowserWindow.getAllWindows().forEach(win => win.destroy()); app.exit(0);
})().catch(error => { console.error(error.stack); app.exit(1); });
