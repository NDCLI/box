const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const physicalFs = require('original-fs').promises;
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { safeStorage } = require('electron');

const APP_ID = 'com.ndcli.cvatboxcounter';
const APP_TITLE = 'Cvat Tools';
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
let savedDefaultTokens = {};

function defaultToken() {
  try {
    return require('./generated/default-token.cjs');
  } catch {
    return '';
  }
}

function defaultTokens() {
  try {
    return { ...savedDefaultTokens, ...require('./generated/default-tokens.cjs') };
  } catch {
    const token = defaultToken();
    return { ...savedDefaultTokens, ...(token ? { '*': token } : {}) };
  }
}

async function restoreDefaultTokens() {
  if (!safeStorage.isEncryptionAvailable()) return;
  const filename = path.join(app.getPath('userData'), 'cvat-default-pats.bin');
  try {
    const parsed = JSON.parse(safeStorage.decryptString(await fs.readFile(filename)));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      savedDefaultTokens = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string' && value));
    }
  } catch { /* A new machine has no stored server tokens yet. */ }
  const tokens = defaultTokens();
  if (Object.keys(tokens).length) {
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(filename, safeStorage.encryptString(JSON.stringify(tokens)));
  }
}

function tokenForServer(serverUrl) {
  const normalized = String(serverUrl || '').trim().replace(/\/+$/, '').toLowerCase();
  const tokens = defaultTokens();
  return tokens[normalized] || tokens['*'] || '';
}

function storedTokenPath() {
  return path.join(app.getPath('userData'), 'cvat-pat.bin');
}

function encryptToken(token) {
  return safeStorage.encryptString(token);
}

function decryptToken(value) {
  return safeStorage.decryptString(value);
}

ipcMain.handle('cvat:token:get', async (_event, serverUrl) => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return decryptToken(await fs.readFile(storedTokenPath()));
  } catch {
    const fallback = tokenForServer(serverUrl);
    if (!fallback) return null;
    await fs.mkdir(path.dirname(storedTokenPath()), { recursive: true });
    await fs.writeFile(storedTokenPath(), encryptToken(fallback));
    return fallback;
  }
});

ipcMain.handle('cvat:token:set', async (_event, value) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows không hỗ trợ mã hóa token trên thiết bị này.');
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token) {
    await fs.rm(storedTokenPath(), { force: true });
    return;
  }
  await fs.mkdir(path.dirname(storedTokenPath()), { recursive: true });
  await fs.writeFile(storedTokenPath(), encryptToken(token));
});

ipcMain.handle('cvat:token:has-default', () => Object.keys(defaultTokens()).length > 0);

function cvatApiBaseUrl(serverUrl) {
  const parsedUrl = new URL(serverUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('URL CVAT không hợp lệ.');
  const normalized = parsedUrl.toString().replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

function cvatPath({ resource, taskId, jobId, frameId }) {
  const id = Number(taskId);
  if (resource === 'tasks') return '/tasks?page_size=1000';
  if (resource === 'jobs' && Number.isInteger(id) && id > 0) return `/jobs?task_id=${id}&page_size=1000`;
  if (resource === 'labels' && Number.isInteger(id) && id > 0) return `/labels?task_id=${id}&page_size=1000`;
  const job = Number(jobId);
  if (resource === 'job' && Number.isInteger(job) && job > 0) return `/jobs/${job}`;
  if (resource === 'jobAnnotations' && Number.isInteger(job) && job > 0) return `/jobs/${job}/annotations`;
  if (resource === 'jobAnnotationsDelete' && Number.isInteger(job) && job > 0) return `/jobs/${job}/annotations?action=delete`;
  if (resource === 'jobFrame' && Number.isInteger(job) && job > 0 && /^\d+$/.test(String(frameId))) return `/jobs/${job}/data?type=frame&number=${encodeURIComponent(frameId)}&quality=compressed`;
  if (!Number.isInteger(id) || id < 1) throw new Error('Task ID không hợp lệ.');
  if (resource === 'task') return `/tasks/${id}`;
  if (resource === 'meta') return `/tasks/${id}/data/meta`;
  if (resource === 'annotations') return `/tasks/${id}/annotations`;
  if (resource === 'frame' && /^\d+$/.test(String(frameId))) {
    return `/tasks/${id}/data?type=frame&number=${encodeURIComponent(frameId)}&quality=compressed`;
  }
  throw new Error('Yêu cầu CVAT không hợp lệ.');
}

ipcMain.handle('cvat:request', async (_event, request) => {
  const suppliedToken = typeof request?.token === 'string' ? request.token.trim() : '';
  const token = suppliedToken || tokenForServer(request?.serverUrl);
  if (!request || typeof request.serverUrl !== 'string' || token.length === 0) {
    throw new Error('Thiếu URL CVAT hoặc token.');
  }

  const resource = request.resource;
  const method = request.method || 'GET';
  if (!['GET', 'PATCH'].includes(method)) throw new Error('Phương thức CVAT không được phép.');
  if (method === 'PATCH' && resource !== 'jobAnnotationsDelete') {
    throw new Error('Chỉ cho phép PATCH xóa Shape trong Job.');
  }
  if (method === 'GET' && resource === 'jobAnnotationsDelete') {
    throw new Error('Endpoint xóa Shape chỉ nhận PATCH.');
  }
  const response = await fetch(`${cvatApiBaseUrl(request.serverUrl)}${cvatPath(request)}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: resource === 'frame' || resource === 'jobFrame' ? '*/*' : 'application/vnd.cvat+json, application/json',
      ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'PATCH' ? { body: JSON.stringify(request.body ?? []) } : {}),
  });

  if (resource === 'frame' || resource === 'jobFrame') {
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      data: Buffer.from(await response.arrayBuffer()),
    };
  }

  if (response.status === 204) return { status: response.status, data: null };
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data };
});

ipcMain.handle('cvat:backup:save', async (_event, payload) => {
  if (!payload || typeof payload !== 'object' || !Number.isInteger(payload.jobId)) {
    throw new Error('Dữ liệu backup không hợp lệ.');
  }
  const backupDir = path.join(app.getPath('userData'), 'cvat-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let serverSlug = 'server';
  try { serverSlug = new URL(String(payload.serverUrl || '')).hostname.replace(/[^a-z0-9.-]/gi, '_') || serverSlug; } catch { /* keep fallback */ }
  const backupPath = path.join(backupDir, `job-${payload.jobId}-${serverSlug}-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(payload, null, 2), 'utf8');
  return { path: backupPath };
});

ipcMain.handle('cvat:backup:open-folder', async () => {
  const backupDir = path.join(app.getPath('userData'), 'cvat-backups');
  await fs.mkdir(backupDir, { recursive: true });
  const result = await shell.openPath(backupDir);
  if (result) throw new Error(result);
});

let updateCheckRunning = false;
ipcMain.handle('app:info', async () => {
  let lastUpdate = null;
  try { lastUpdate = JSON.parse((await fs.readFile(path.join(app.getPath('userData'), 'updates', 'status.json'), 'utf8')).replace(/^\uFEFF/, '')); } catch { /* No update has run yet. */ }
  return { version: app.getVersion(), executablePath: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, lastUpdate };
});
ipcMain.handle('app:update:check', () => checkForPortableUpdate(true));
async function checkForPortableUpdate(manual = false) {
  if (updateCheckRunning) return { message: 'Đang kiểm tra cập nhật…' };
  if (process.platform !== 'win32' || !app.isPackaged || process.windowsStore) return { message: 'Kiểm tra cập nhật chỉ dùng trong bản Windows chạy độc lập.' };
  updateCheckRunning = true;
  try {
    const response = await fetch('https://api.github.com/repos/NDCLI/box/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'CVAT-Box-Counter-Updater' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Không kiểm tra được cập nhật (HTTP ${response.status}).`);
    const release = await response.json();
    const latest = String(release.tag_name || '').replace(/^v/, '');
    const parts = value => value.split('.').map(Number);
    const currentParts = parts(app.getVersion()), latestParts = parts(latest);
    if (latestParts.length !== 3 || latestParts.some(Number.isNaN)) return;
    const firstDifference = latestParts.findIndex((n, i) => n !== currentParts[i]);
    if (firstDifference < 0 || latestParts[firstDifference] < currentParts[firstDifference]) return { message: `Bạn đang dùng phiên bản mới nhất (${app.getVersion()}).` };
    const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
    const assetName = isPortable ? `CVAT-Tools-${latest}-portable-win-x64.exe` : `CVAT-Tools-${latest}-win-x64.zip`;
    const asset = release.assets?.find(item => item.name === assetName);
    const checksum = release.assets?.find(item => item.name === `${asset?.name}.sha256`);
    if (!asset || !checksum || asset.size > 300 * 1024 * 1024) throw new Error('Bản phát hành chưa có đủ gói cập nhật và checksum.');
    const [binaryResponse, hashResponse] = await Promise.all([fetch(asset.browser_download_url), fetch(checksum.browser_download_url)]);
    if (!binaryResponse.ok || !hashResponse.ok) throw new Error('Không tải được bản cập nhật.');
    const binary = Buffer.from(await binaryResponse.arrayBuffer());
    const expectedHash = (await hashResponse.text()).trim().split(/\s+/)[0].toLowerCase();
    if (binary.length !== asset.size || crypto.createHash('sha256').update(binary).digest('hex') !== expectedHash) throw new Error('Checksum bản cập nhật không khớp.');
    const choice = await dialog.showMessageBox({ type: 'info', buttons: ['Cập nhật ngay', 'Để sau'], defaultId: 0, cancelId: 1, message: `Có bản cập nhật CVAT Box Counter ${latest}.`, detail: 'Ứng dụng sẽ tải bản vá và khởi động lại. PAT đã lưu được giữ trên máy này.' });
    if (choice.response !== 0) return { message: `Có phiên bản ${latest}. Bạn đã chọn cập nhật sau.` };
    const target = isPortable ? process.env.PORTABLE_EXECUTABLE_FILE : path.dirname(process.execPath);
    if (!path.isAbsolute(target) || target === path.parse(target).root) throw new Error('Thư mục app không hợp lệ.');
    if (!isPortable) await physicalFs.access(path.join(target, 'resources', 'app.asar'));
    const updateDirectory = path.join(isPortable ? path.dirname(target) : target, '.updates');
    await fs.mkdir(updateDirectory, { recursive: true });
    const staged = path.join(await fs.mkdtemp(path.join(updateDirectory, 'patch-')), assetName);
    await fs.writeFile(staged, binary);
    const quotePS = value => "'" + value.replace(/'/g, "''") + "'";
    const executableName = path.basename(process.execPath);
    const helperDirectory = path.join(app.getPath('userData'), 'updates');
    await fs.mkdir(helperDirectory, { recursive: true });
    const statusPath = path.join(helperDirectory, 'status.json');
    const script = `$ErrorActionPreference='Stop'
$target=${quotePS(target)}
$staged=${quotePS(staged)}
$payload=$staged
$log=${quotePS(path.join(helperDirectory, 'last-update.log'))}
$statusFile=${quotePS(statusPath)}
function Write-UpdateStatus($state, $message) {
  @{ state=$state; message=$message; fromVersion=${quotePS(app.getVersion())}; toVersion=${quotePS(latest)}; time=(Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
}
try {
  Write-UpdateStatus 'applying' 'Đang giải nén và cài bản vá.'
  ${isPortable ? '' : `
  $payload=Join-Path (Split-Path $staged -Parent) 'unpacked'
  Expand-Archive -LiteralPath $staged -DestinationPath $payload
  if (!(Test-Path -LiteralPath (Join-Path $payload 'resources\\app.asar')) -or !(Test-Path -LiteralPath (Join-Path $payload ${quotePS(executableName)}))) { throw 'ZIP không chứa app hợp lệ.' }
  `}
  while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }
  Start-Sleep -Seconds 2
  ${isPortable ? `Remove-Item -LiteralPath $target -Force
  Move-Item -LiteralPath $payload -Destination $target` : `Copy-Item -Path (Join-Path $payload '*') -Destination $target -Recurse -Force`}
  Remove-Item -LiteralPath (Split-Path $staged -Parent) -Recurse -Force
  Start-Process -FilePath ${isPortable ? '$target' : `(Join-Path $target ${quotePS(executableName)})`} -WorkingDirectory ${isPortable ? '(Split-Path $target -Parent)' : '$target'} -WindowStyle Normal
  'Update completed' | Set-Content -LiteralPath $log
  Write-UpdateStatus 'success' 'Đã thay app và khởi động phiên bản mới.'
  Get-ChildItem -LiteralPath (Split-Path $target -Parent) -Filter ((Split-Path $target -Leaf) + '.backup-*') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} catch {
  $_ | Out-String | Set-Content -LiteralPath $log
  Write-UpdateStatus 'failed' $_.Exception.Message
  exit 1
}`;
    const helperPath = path.join(helperDirectory, `apply-${Date.now()}.ps1`);
    await fs.writeFile(helperPath, '\uFEFF' + script, 'utf8');
    await fs.writeFile(statusPath, JSON.stringify({ state: 'scheduled', fromVersion: app.getVersion(), toVersion: latest, message: 'Đã tải bản vá; đang khởi động trình cập nhật.' }));
    const batchPath = helperPath.replace(/\.ps1$/, '.cmd');
    const launchLog = path.join(helperDirectory, 'helper-launch.log');
    await fs.writeFile(batchPath, '@echo off\r\nstart "" /b "%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%CVAT_UPDATE_SCRIPT%" >>"%CVAT_UPDATE_LOG%" 2>&1\r\n', 'ascii');
    const child = spawn('cmd.exe', ['/d', '/v:off', '/s', '/c', '""%CVAT_UPDATE_LAUNCHER%""'], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true, cwd: os.tmpdir(), env: { ...process.env, CVAT_UPDATE_LAUNCHER: batchPath, CVAT_UPDATE_SCRIPT: helperPath, CVAT_UPDATE_LOG: launchLog } });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    let helperStarted = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const status = JSON.parse((await fs.readFile(statusPath, 'utf8')).replace(/^\uFEFF/, ''));
      if (status.state === 'failed') throw new Error(status.message);
      if (status.state !== 'scheduled') { helperStarted = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!helperStarted) throw new Error(`Không khởi động được trình cập nhật. Nhật ký: ${launchLog}`);
    app.quit();
  } catch (error) { if (manual) throw error; }
  finally { updateCheckRunning = false; }
}

function isExternalUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'app-icon.ico');
  const mainWindow = new BrowserWindow({
    title: APP_TITLE,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#070a12',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: Boolean(rendererUrl),
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.on('page-title-updated', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedUrl = rendererUrl
      ? url.startsWith(rendererUrl)
      : url.startsWith('file://');

    if (!allowedUrl) {
      event.preventDefault();
      if (isExternalUrl(url)) void shell.openExternal(url);
    }
  });

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist-desktop', 'index.html'));
  }
}

app.setAppUserModelId(APP_ID);

app.whenReady().then(async () => {
  await restoreDefaultTokens();
  Menu.setApplicationMenu(null);
  createWindow();
  setTimeout(() => void checkForPortableUpdate(), 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
