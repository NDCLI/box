const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cvatDesktop', {
  request: (request) => ipcRenderer.invoke('cvat:request', request),
});
