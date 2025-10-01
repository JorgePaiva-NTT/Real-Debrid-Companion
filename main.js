import { app, BrowserWindow, ipcMain, shell } from "electron";
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
} from "./rd-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store({ name: "settings" });

let win;

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
      nodeIntegrationInSubFrames: false, // Required for sandboxed preloads
      sandbox: true,
    },
    title: "RD Companion",
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // On macOS it's common to keep the app open until Cmd+Q
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

// Optional: generic pass-through (use sparingly)
ipcMain.handle("rd:fetch", async (_evt, path, params) => {
  const token = await getToken();
  if (!token) throw new Error("No token set");
  return rdFetch(token, path, params);
});

ipcMain.handle("open:external", async (_evt, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new Error("Invalid URL");
  }
  await shell.openExternal(url);
  return true;
});
