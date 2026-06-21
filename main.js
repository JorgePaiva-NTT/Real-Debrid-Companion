import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  Notification,
  clipboard,
  nativeImage,
} from "electron";
import path from "path";
import { fileURLToPath } from "url";
import Store from "electron-store";
import { getToken, saveToken, clearToken } from "./keytar-store.js";
import {
  rdFetch,
  rdUser,
  rdTraffic,
  rdTorrents,
  rdDownloads,
  rdAddMagnet,
  rdTorrentInfo,
  rdSelectFiles,
  rdDeleteTorrent,
  rdDeleteDownload,
  rdUnrestrict,
} from "./rd-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({ name: "settings" });

let win;
let tray = null;
let clipboardInterval = null;
let lastClipboard = "";

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
    },
    title: "RD Companion",
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray instead of closing (if setting enabled)
  win.on("close", (e) => {
    if (store.get("minimizeToTray", true) && !app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  // Use a simple 16x16 tray icon (create a placeholder if none exists)
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  tray = new Tray(
    nativeImage.createEmpty().resize({ width: 16, height: 16 })
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        win?.show();
        win?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Unrestrict from Clipboard",
      click: async () => {
        const link = clipboard.readText().trim();
        if (link && /^https?:\/\//i.test(link)) {
          try {
            const token = await getToken();
            if (!token) return;
            const result = await rdUnrestrict(token, link);
            showNotification(
              "Link Unrestricted",
              result?.filename || "Done"
            );
            win?.webContents.send("unrestrict:done", result);
          } catch (err) {
            showNotification("Unrestrict Failed", err.message);
          }
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("RD Companion");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    win?.show();
    win?.focus();
  });
}

function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// ─── Clipboard Monitoring ───────────────────────────────────────────────────
// Supported hoster link patterns (common RD-supported hosts)
const HOSTER_PATTERNS = [
  /1fichier\.com/i,
  /uptobox\.com/i,
  /rapidgator\./i,
  /mega\.nz/i,
  /filefactory\.com/i,
  /turbobit\.net/i,
  /uploaded\./i,
  /nitroflare\.com/i,
];

function startClipboardMonitor() {
  if (clipboardInterval) clearInterval(clipboardInterval);
  lastClipboard = clipboard.readText();

  clipboardInterval = setInterval(async () => {
    if (!store.get("clipboardMonitor", false)) return;

    const text = clipboard.readText().trim();
    if (text === lastClipboard || !text) return;
    lastClipboard = text;

    // Check if it looks like a supported link
    if (
      /^https?:\/\//i.test(text) &&
      HOSTER_PATTERNS.some((p) => p.test(text))
    ) {
      try {
        const token = await getToken();
        if (!token) return;
        const result = await rdUnrestrict(token, text);
        showNotification(
          "Auto-Unrestricted",
          result?.filename || result?.download || "Link unrestricted"
        );
        win?.webContents.send("unrestrict:done", result);
      } catch (err) {
        showNotification("Auto-Unrestrict Failed", err.message);
      }
    }
  }, 2000);
}

function stopClipboardMonitor() {
  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }
}

// ─── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  startClipboardMonitor();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else win?.show();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopClipboardMonitor();
});

// IPC: token management
ipcMain.handle("token:get", async () => {
  return (await getToken()) ?? null;
});

ipcMain.handle("token:set", async (_evt, token) => {
  if (!token || typeof token !== "string") throw new Error("Invalid token");
  await saveToken(token.trim());
  return true;
});

ipcMain.handle("token:clear", async () => {
  await clearToken();
  return true;
});

// IPC: RD API calls
ipcMain.handle("rd:user", async () => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdUser(token);
});

ipcMain.handle("rd:traffic", async () => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdTraffic(token);
});

ipcMain.handle("rd:torrents", async (_evt, opts = {}) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdTorrents(token, opts);
});

ipcMain.handle("rd:downloads", async (_evt, opts = {}) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdDownloads(token, opts);
});

// IPC: Torrent management
ipcMain.handle("rd:addMagnet", async (_evt, magnet) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  if (!magnet || typeof magnet !== "string")
    throw new Error("Invalid magnet link");
  return rdAddMagnet(token, magnet.trim());
});

ipcMain.handle("rd:torrentInfo", async (_evt, id) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdTorrentInfo(token, id);
});

ipcMain.handle("rd:selectFiles", async (_evt, id, files) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdSelectFiles(token, id, files);
});

ipcMain.handle("rd:deleteTorrent", async (_evt, id) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdDeleteTorrent(token, id);
});

// IPC: Download management
ipcMain.handle("rd:deleteDownload", async (_evt, id) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdDeleteDownload(token, id);
});

// IPC: Unrestrict
ipcMain.handle("rd:unrestrict", async (_evt, link, opts = {}) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  if (!link || typeof link !== "string") throw new Error("Invalid link");
  return rdUnrestrict(token, link.trim(), opts);
});

// IPC: Settings
ipcMain.handle("settings:get", (_evt, key) => {
  return store.get(key);
});

ipcMain.handle("settings:set", (_evt, key, value) => {
  store.set(key, value);
  // React to specific setting changes
  if (key === "clipboardMonitor") {
    value ? startClipboardMonitor() : stopClipboardMonitor();
  }
  return true;
});

// Optional: generic pass-through (use sparingly)
ipcMain.handle("rd:fetch", async (_evt, apiPath, params) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdFetch(token, apiPath, params);
});

ipcMain.handle("open:external", async (_evt, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new Error("Invalid URL");
  }
  await shell.openExternal(url);
  return true;
});
