import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { connectMongo } from "../db/mongoConnection.js";
import { registerIpcHandlers, setCurrentUserId } from "./ipc.js";
import { getToken } from "./sessionManager.js";
import * as auth from "../services/authService.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "TradeMAX",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "../preload/preload/index.js"),
    },
  });

  registerIpcHandlers(mainWindow);

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
  }
}

app.whenReady().then(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI not set");
    await connectMongo(mongoUri);
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
