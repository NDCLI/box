const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cvatDesktop', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('app:update:check'),
  request: (request) => ipcRenderer.invoke('cvat:request', request),
  getStoredToken: (serverUrl) => ipcRenderer.invoke('cvat:token:get', serverUrl),
  saveToken: (token) => ipcRenderer.invoke('cvat:token:set', token),
  hasDefaultToken: () => ipcRenderer.invoke('cvat:token:has-default'),
  saveBackup: (payload) => ipcRenderer.invoke('cvat:backup:save', payload),
  openBackupFolder: () => ipcRenderer.invoke('cvat:backup:open-folder'),
});
