import { contextBridge, ipcRenderer } from "electron";
import { EVENT_CHANNELS } from "../shared/constants.js";

const api = {
    auth: {
        register: (payload: { name: string; email: string; password: string }) => ipcRenderer.invoke("auth:register", payload),
        login: (payload: { email: string; password: string }) => ipcRenderer.invoke("auth:login", payload),
        logout: () => ipcRenderer.invoke("auth:logout"),
        getSession: () => ipcRenderer.invoke("auth:session")
    },
    settings: {
        updateApiKeys: (payload: { binanceKey?: string; binanceSecret?: string; bybitKey?: string; bybitSecret?: string }) =>
            ipcRenderer.invoke("settings:update-api-keys", payload),
        update: (patch: Record<string, unknown>) => ipcRenderer.invoke("settings:update", patch)
    },
    trading: {
        getPortfolio: () => ipcRenderer.invoke("portfolio:get"),
        getPositions: () => ipcRenderer.invoke("positions:get"),
        getTrades: () => ipcRenderer.invoke("trades:get"),
        getLastDecision: () => ipcRenderer.invoke("ai:last-decision"),
        startAgent: (payload: { symbol?: string }) => ipcRenderer.invoke("agent:start", payload),
        stopAgent: () => ipcRenderer.invoke("agent:stop"),
        killSwitch: (payload: { symbols: string[] }) => ipcRenderer.invoke("agent:kill-switch", payload)
    },
    stream: {
        onMarket: (cb: (payload: unknown) => void) => {
            const listener = (_: unknown, payload: unknown) => cb(payload);
            ipcRenderer.on(EVENT_CHANNELS.market, listener);
            return () => ipcRenderer.removeListener(EVENT_CHANNELS.market, listener);
        },
        onLogs: (cb: (payload: unknown) => void) => {
            const listener = (_: unknown, payload: unknown) => cb(payload);
            ipcRenderer.on(EVENT_CHANNELS.logs, listener);
            return () => ipcRenderer.removeListener(EVENT_CHANNELS.logs, listener);
        },
        onAI: (cb: (payload: unknown) => void) => {
            const listener = (_: unknown, payload: unknown) => cb(payload);
            ipcRenderer.on(EVENT_CHANNELS.ai, listener);
            return () => ipcRenderer.removeListener(EVENT_CHANNELS.ai, listener);
        }
    }
};

contextBridge.exposeInMainWorld("trademax", api);
