const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { safeStorage } = require('electron');

const APP_ID = 'com.ndcli.cvatboxcounter';
const APP_TITLE = 'CVAT Box Counter & Duplicate Inspector';
const rendererUrl = process.env.ELECTRON_RENDERER_URL;

function storedTokenPath() {
  return path.join(app.getPath('userData'), 'cvat-pat.bin');
}

async function encryptToken(token) {
  if (typeof safeStorage.encryptStringAsync !== 'function') return safeStorage.encryptString(token);
  try {
    return await safeStorage.encryptStringAsync(token);
  } catch {
    return safeStorage.encryptString(token);
  }
}

async function decryptToken(value) {
  if (typeof safeStorage.decryptStringAsync !== 'function') return safeStorage.decryptString(value);
  try {
    return await safeStorage.decryptStringAsync(value);
  } catch {
    return safeStorage.decryptString(value);
  }
}

ipcMain.handle('cvat:token:get', async () => {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    return await decryptToken(await fs.readFile(storedTokenPath()));
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
  await fs.writeFile(storedTokenPath(), await encryptToken(token));
});

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
  const token = typeof request?.token === 'string' ? request.token.trim() : '';
  if (!request || typeof request.serverUrl !== 'string' || token.length === 0) {
    throw new Error('Thiếu URL CVAT hoặc token.');
  }

  const resource = request.resource;
  const response = await fetch(`${cvatApiBaseUrl(request.serverUrl)}${cvatPath(request)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: resource === 'frame' || resource === 'jobFrame' ? '*/*' : 'application/vnd.cvat+json, application/json',
    },
  });

  if (resource === 'frame' || resource === 'jobFrame') {
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      data: Buffer.from(await response.arrayBuffer()),
    };
  }

  return { status: response.status, data: await response.json() };
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
