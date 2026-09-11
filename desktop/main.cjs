const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { safeStorage } = require('electron');

const APP_ID = 'com.ndcli.cvatboxcounter';
const APP_TITLE = 'Cvat Tools';
const rendererUrl = process.env.ELECTRON_RENDERER_URL;

function defaultToken() {
  try {
    return require('./generated/default-token.cjs');
  } catch {
    return '';
  }
}

function defaultTokens() {
  try {
    return require('./generated/default-tokens.cjs');
  } catch {
    const token = defaultToken();
    return token ? { '*': token } : {};
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

ipcMain.handle('cvat:token:get', async () => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return decryptToken(await fs.readFile(storedTokenPath()));
  } catch {
    return null;
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
