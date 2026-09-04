const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const APP_ID = 'com.ndcli.cvatboxcounter';
const APP_TITLE = 'CVAT Box Counter & Duplicate Inspector';
const rendererUrl = process.env.ELECTRON_RENDERER_URL;

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
