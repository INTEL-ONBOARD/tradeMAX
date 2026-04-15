import { BrowserWindow, ipcMain } from "electron";
import { UserModel } from "../db/models/User.js";
import { TradeModel } from "../db/models/Trade.js";
import { DEFAULT_RISK_PROFILE, EVENT_CHANNELS } from "../shared/constants.js";
import { loginUser, registerUser, updateApiKeys, updateUserSettings } from "../services/authService.js";
import { logStream } from "../services/loggerService.js";
import { tradeEngine, } from "../services/runtimeContext.js";
import { tradeEngineEvents } from "../services/tradeEngine.js";
import { clearAuthState, getAuthState, setAuthState } from "./sessionManager.js";

function requireAuth() {
    const auth = getAuthState();
    if (!auth) {
        throw new Error("Not authenticated");
    }
    return auth;
}

export function registerIpc(mainWindow: BrowserWindow): void {
    ipcMain.handle("auth:register", async (_event, payload) => {
        const data = await registerUser(payload);
        setAuthState(data);
        return data;
    });

    ipcMain.handle("auth:login", async (_event, payload) => {
        const data = await loginUser(payload);
        setAuthState(data);
        return data;
    });

    ipcMain.handle("auth:logout", async () => {
        clearAuthState();
        return { ok: true };
    });

    ipcMain.handle("auth:session", async () => {
        return getAuthState();
    });

    ipcMain.handle("settings:update-api-keys", async (_event, payload) => {
        const auth = requireAuth();
        await updateApiKeys(auth.session.userId, payload);
        return { ok: true };
    });

    ipcMain.handle("settings:update", async (_event, patch) => {
        const auth = requireAuth();
        await updateUserSettings(auth.session.userId, patch);
        const user = await UserModel.findById(auth.session.userId).lean();
        if (user) {
            setAuthState({
                token: auth.token,
                session: {
                    userId: String(user._id),
                    email: user.email,
                    name: user.name,
                    agentModeEnabled: user.agentModeEnabled,
                    tradingMode: user.tradingMode,
                    themePreference: user.themePreference,
                    riskProfile: user.riskProfile || DEFAULT_RISK_PROFILE
                }
            });
        }
        return { ok: true };
    });

    ipcMain.handle("portfolio:get", async () => {
        const auth = requireAuth();
        const mode = getAuthState()?.session.tradingMode || "spot";
        return tradeEngine.getPortfolio(auth.session.userId, mode);
    });

    ipcMain.handle("positions:get", async () => {
        const auth = requireAuth();
        const mode = getAuthState()?.session.tradingMode || "spot";
        return tradeEngine.getPositions(auth.session.userId, mode);
    });

    ipcMain.handle("trades:get", async () => {
        const auth = requireAuth();
        return tradeEngine.getRecentTrades(auth.session.userId);
    });

    ipcMain.handle("ai:last-decision", async () => {
        const auth = requireAuth();
        return tradeEngine.getLatestDecision(auth.session.userId);
    });

    ipcMain.handle("agent:start", async (_event, payload: { symbol?: string }) => {
        const auth = requireAuth();
        await tradeEngine.setAgentMode(auth.session.userId, true);
        await tradeEngine.start(auth.session.userId, payload?.symbol || "BTCUSDT");
        return { ok: true };
    });

    ipcMain.handle("agent:stop", async () => {
        const auth = requireAuth();
        await tradeEngine.setAgentMode(auth.session.userId, false);
        await tradeEngine.stop(auth.session.userId);
        return { ok: true };
    });

    ipcMain.handle("agent:kill-switch", async (_event, payload: { symbols: string[] }) => {
        const auth = requireAuth();
        await tradeEngine.killSwitch(auth.session.userId, payload.symbols || ["BTCUSDT"]);
        return { ok: true };
    });

    ipcMain.handle("logs:recent", async () => {
        const auth = requireAuth();
        return TradeModel.find({ userId: auth.session.userId }).sort({ createdAt: -1 }).limit(30).lean();
    });

    logStream.on("event", (entry) => {
        mainWindow.webContents.send(EVENT_CHANNELS.logs, entry);
    });

    tradeEngineEvents.on("market", (entry) => {
        mainWindow.webContents.send(EVENT_CHANNELS.market, entry);
    });

    tradeEngineEvents.on("ai", (entry) => {
        mainWindow.webContents.send(EVENT_CHANNELS.ai, entry);
    });
}
