import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

// Inlined from shared/constants to avoid sandbox-related module resolution issues
const ALLOWED_INVOKE_CHANNELS = [
  "auth:register", "auth:login", "auth:logout", "auth:session",
  "settings:save-api-keys", "settings:save-openai-key", "settings:get", "settings:update",
  "portfolio:get", "positions:get", "position:close", "trades:history", "exchange:closed-pnl",
  "ai:last-decision", "ai:list-models",
  "ai:self-review",
  "profile:list", "profile:save", "profile:apply", "profile:delete",
  "agent:start", "agent:stop", "agent:kill-switch", "agent:reset-freeze",
  "logs:recent",
  "exchange:pairs",
  "backtest:run"
];

const ALLOWED_STREAM_CHANNELS = [
  "stream:market-tick", "stream:portfolio", "stream:positions",
  "stream:trade-executed", "stream:ai-decision", "stream:agent-status", "stream:log",
  "session:restored",
  "stream:notification",
  "stream:backtest-progress"
];

contextBridge.exposeInMainWorld("api", {
  invoke(channel: string, data?: unknown): Promise<unknown> {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, data);
  },

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!ALLOWED_STREAM_CHANNELS.includes(event)) {
      console.warn(`Stream event not allowed: ${event}`);
      return () => {};
    }
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(event, handler);
    return () => {
      ipcRenderer.removeListener(event, handler);
    };
  },
});
