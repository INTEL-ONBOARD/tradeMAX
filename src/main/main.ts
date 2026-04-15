import "dotenv/config";
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { connectMongo } from "../db/mongoConnection.js";
import { registerIpc } from "./ipc.js";

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
    mainWindow = new BrowserWindow({
        width: 1500,
        height: 960,
        minWidth: 1200,
        minHeight: 800,
        backgroundColor: "#0B0B12",
        webPreferences: {
            preload: path.join(process.cwd(), "dist/preload/preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: true
        }
    });

    registerIpc(mainWindow);

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        await mainWindow.loadURL(devServerUrl);
    } else {
        await mainWindow.loadFile(path.join(process.cwd(), "dist/renderer/index.html"));
    }
}

app.whenReady().then(async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI in environment");
    }
    await connectMongo(mongoUri);
    await createWindow();

    app.on("activate", async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
