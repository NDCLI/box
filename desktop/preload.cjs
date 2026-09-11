const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cvatDesktop', {
  request: (request) => ipcRenderer.invoke('cvat:request', request),
  getStoredToken: () => ipcRenderer.invoke('cvat:token:get'),
  saveToken: (token) => ipcRenderer.invoke('cvat:token:set', token),
  hasDefaultToken: () => ipcRenderer.invoke('cvat:token:has-default'),
  saveBackup: (payload) => ipcRenderer.invoke('cvat:backup:save', payload),
  openBackupFolder: () => ipcRenderer.invoke('cvat:backup:open-folder'),
});
