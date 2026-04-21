import { app, BrowserWindow } from "electron";
import path from "node:path";
import dotenv from "dotenv";
import { connectMongo } from "../db/mongoConnection.js";
import { registerIpcHandlers, setMainWindow } from "./ipc.js";
import { installMainProcessCrashGuards, safeProcessLog } from "../shared/processDiagnostics.js";

dotenv.config();
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const shouldOpenDevTools =
  isDev && ["1", "true", "yes"].includes((process.env.TRADEMAX_OPEN_DEVTOOLS ?? "").toLowerCase());

installMainProcessCrashGuards();

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
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

  setMainWindow(window);

  if (isDev) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL!);
    if (shouldOpenDevTools) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    await window.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI not set");
    await connectMongo(mongoUri);
    registerIpcHandlers();
  } catch (err) {
    safeProcessLog("FATAL", "MongoDB connection failed", err);
    app.quit();
    return;
  }

  await createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
