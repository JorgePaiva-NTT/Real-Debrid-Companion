const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // Open external links in default browser
  open: (url) => ipcRenderer.invoke("open:external", url),

  // Token management
  getToken: () => ipcRenderer.invoke("token:get"),
  setToken: (token) => ipcRenderer.invoke("token:set", token),
  clearToken: () => ipcRenderer.invoke("token:clear"),

  // Real-Debrid API calls
  getUser: () => ipcRenderer.invoke("rd:user"),
  getTraffic: () => ipcRenderer.invoke("rd:traffic"),
  getTorrents: (opts = {}) => ipcRenderer.invoke("rd:torrents", opts),
  getDownloads: (opts = {}) => ipcRenderer.invoke("rd:downloads", opts),

  // Generic API call
  rdFetch: (path, params) => ipcRenderer.invoke("rd:fetch", path, params),
});
