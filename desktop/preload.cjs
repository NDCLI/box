const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cvatDesktop', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  checkForUpdates: () => ipcRenderer.invoke('app:update:check'),
  request: (request) => ipcRenderer.invoke('cvat:request', request),
  viewerOpen: (request) => ipcRenderer.invoke('viewer:open', request),
  viewerFrame: (request) => ipcRenderer.invoke('viewer:frame', request),
  viewerCancel: (request) => ipcRenderer.invoke('viewer:cancel', request),
  viewerClose: (sessionId) => ipcRenderer.invoke('viewer:close', sessionId),
  viewerCache: (request) => ipcRenderer.invoke('viewer:cache', request),
  viewerPreload: (sessionId) => ipcRenderer.invoke('viewer:preload', sessionId),
  viewerPreloadStatus: (sessionId) => ipcRenderer.invoke('viewer:preload-status', sessionId),
  getStoredToken: (serverUrl) => ipcRenderer.invoke('cvat:token:get', serverUrl),
  saveToken: (token, serverUrl) => ipcRenderer.invoke('cvat:token:set', token, serverUrl),
  hasDefaultToken: () => ipcRenderer.invoke('cvat:token:has-default'),
  saveBackup: (payload) => ipcRenderer.invoke('cvat:backup:save', payload),
  openBackupFolder: () => ipcRenderer.invoke('cvat:backup:open-folder'),
});
