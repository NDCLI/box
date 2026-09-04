const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');

const APP_ID = 'com.ndcli.cvatboxcounter';
const APP_TITLE = 'CVAT Box Counter & Duplicate Inspector';
const rendererUrl = process.env.ELECTRON_RENDERER_URL;

function cvatApiBaseUrl(serverUrl) {
  const parsedUrl = new URL(serverUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('URL CVAT không hợp lệ.');
  const normalized = parsedUrl.toString().replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

function cvatPath({ resource, taskId, frameId }) {
  const id = Number(taskId);
  if (resource === 'tasks') return '/tasks?limit=100';
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
      Authorization: `Token ${token}`,
      Accept: resource === 'frame' ? 'image/*' : 'application/vnd.cvat+json, application/json',
    },
  });

  if (resource === 'frame') {
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
