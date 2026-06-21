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

  // Torrent management
  addMagnet: (magnet) => ipcRenderer.invoke("rd:addMagnet", magnet),
  torrentInfo: (id) => ipcRenderer.invoke("rd:torrentInfo", id),
  selectFiles: (id, files) => ipcRenderer.invoke("rd:selectFiles", id, files),
  deleteTorrent: (id) => ipcRenderer.invoke("rd:deleteTorrent", id),

  // Download management
  deleteDownload: (id) => ipcRenderer.invoke("rd:deleteDownload", id),

  // Unrestrict
  unrestrict: (link, opts) => ipcRenderer.invoke("rd:unrestrict", link, opts),

  // Settings
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),

  // Generic API call
  rdFetch: (path, params) => ipcRenderer.invoke("rd:fetch", path, params),
});
