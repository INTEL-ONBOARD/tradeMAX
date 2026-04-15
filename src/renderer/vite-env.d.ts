/// <reference types="vite/client" />

interface TradeMaxAPI {
    auth: {
        register(payload: { name: string; email: string; password: string }): Promise<any>;
        login(payload: { email: string; password: string }): Promise<any>;
        logout(): Promise<any>;
        getSession(): Promise<any>;
    };
    settings: {
        updateApiKeys(payload: { binanceKey?: string; binanceSecret?: string; bybitKey?: string; bybitSecret?: string }): Promise<any>;
        update(patch: Record<string, unknown>): Promise<any>;
    };
    trading: {
        getPortfolio(): Promise<any>;
        getPositions(): Promise<any>;
        getTrades(): Promise<any>;
        getLastDecision(): Promise<any>;
        startAgent(payload: { symbol?: string }): Promise<any>;
        stopAgent(): Promise<any>;
        killSwitch(payload: { symbols: string[] }): Promise<any>;
    };
    stream: {
        onMarket(cb: (payload: unknown) => void): () => void;
        onLogs(cb: (payload: unknown) => void): () => void;
        onAI(cb: (payload: unknown) => void): () => void;
    };
}

declare global {
    interface Window {
        trademax: TradeMaxAPI;
    }
}

export { };
