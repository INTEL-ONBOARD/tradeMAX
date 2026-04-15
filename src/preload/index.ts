import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { ALLOWED_INVOKE_CHANNELS, ALLOWED_STREAM_CHANNELS } from "../shared/constants.js";

contextBridge.exposeInMainWorld("api", {
  invoke(channel: string, data?: unknown): Promise<unknown> {
    if (!(ALLOWED_INVOKE_CHANNELS as readonly string[]).includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, data);
  },

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!(ALLOWED_STREAM_CHANNELS as readonly string[]).includes(event)) {
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
