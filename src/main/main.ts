import { app, BrowserWindow } from "electron";
import path from "node:path";
import dotenv from "dotenv";
import { connectMongo } from "../db/mongoConnection.js";
import { registerIpcHandlers, setMainWindow, setCurrentUserId } from "./ipc.js";
import { getToken } from "./sessionManager.js";
import * as auth from "../services/authService.js";

dotenv.config();
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "TradeMAX",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "../../preload/preload/index.js"),
    },
  });

  setMainWindow(mainWindow);

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function restoreSession(): Promise<void> {
  const token = getToken();
  if (!token || !mainWindow) return;

  const result = await auth.restoreSession(token);
  if (result) {
    setCurrentUserId(result.session.userId);
    mainWindow.webContents.send("session:restored", {
      session: result.session,
      settings: result.settings,
    });

    // Start real-time account streaming if exchange keys are configured
    if (result.settings.hasBinanceKeys || result.settings.hasBybitKeys) {
      const { accountWatcher } = await import("./accountWatcher.js");
      accountWatcher.start(result.session.userId).catch(() => {});
    }
  }
}

app.whenReady().then(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI not set");
    await connectMongo(mongoUri);
    registerIpcHandlers();
  } catch (err) {
    console.error("[FATAL] MongoDB connection failed:", err);
    app.quit();
    return;
  }

  await createWindow();
  await restoreSession();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
