/// <reference types="vite/client" />

interface TradeMaxAPI {
  invoke(channel: string, data?: unknown): Promise<unknown>;
  on(event: string, callback: (data: unknown) => void): () => void;
}

declare global {
  interface Window {
    api: TradeMaxAPI;
  }
}

export {};
