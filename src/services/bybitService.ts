import { RestClientV5, WebsocketClient } from "bybit-api";
import { type Position, type TradeMode } from "../shared/types.js";

export class BybitService {
    private wsClient: WebsocketClient | null = null;

    constructor(private apiKey: string, private apiSecret: string) { }

    private getRest(): RestClientV5 {
        return new RestClientV5({ key: this.apiKey, secret: this.apiSecret, testnet: false });
    }

    async getAccountBalance(_mode: TradeMode): Promise<number> {
        if (!this.apiKey || !this.apiSecret) {
            return 0;
        }
        const rest = this.getRest();
        const res = await rest.getWalletBalance({ accountType: "UNIFIED" });
        const usdtCoin = res?.result?.list?.[0]?.coin?.find((c: any) => c.coin === "USDT");
        return Number(usdtCoin?.walletBalance || 0);
    }

    async getOpenPositions(mode: TradeMode): Promise<Position[]> {
        if (!this.apiKey || !this.apiSecret || mode !== "futures") {
            return [];
        }

        const rest = this.getRest();
        const res = await rest.getPositionInfo({ category: "linear", settleCoin: "USDT" });
        return (res?.result?.list || [])
            .filter((p: any) => Number(p.size) > 0)
            .map((p: any) => ({
                exchange: "bybit",
                symbol: p.symbol,
                side: p.side === "Buy" ? "LONG" : "SHORT",
                quantity: Number(p.size),
                entryPrice: Number(p.avgPrice),
                markPrice: Number(p.markPrice),
                liquidationPrice: Number(p.liqPrice || 0),
                unrealizedPnl: Number(p.unrealisedPnl || 0)
            }));
    }

    async placeOrder(input: {
        symbol: string;
        side: "BUY" | "SELL";
        quantity: number;
        mode: TradeMode;
        leverage?: number;
    }) {
        if (!this.apiKey || !this.apiSecret) {
            throw new Error("Bybit API keys not configured");
        }

        const rest = this.getRest();
        if (input.mode === "futures" && input.leverage) {
            await rest.setLeverage({
                category: "linear",
                symbol: input.symbol,
                buyLeverage: String(input.leverage),
                sellLeverage: String(input.leverage)
            });
        }

        const res = await rest.submitOrder({
            category: input.mode === "futures" ? "linear" : "spot",
            symbol: input.symbol,
            side: input.side === "BUY" ? "Buy" : "Sell",
            orderType: "Market",
            qty: String(input.quantity)
        });

        return res.result;
    }

    async cancelAll(symbol: string, mode: TradeMode): Promise<void> {
        if (!this.apiKey || !this.apiSecret) {
            return;
        }
        const rest = this.getRest();
        await rest.cancelAllOrders({ category: mode === "futures" ? "linear" : "spot", symbol });
    }

    startTickerStream(symbol: string, onPrice: (price: number) => void): void {
        this.wsClient = new WebsocketClient({ key: this.apiKey, secret: this.apiSecret });
        this.wsClient.subscribeV5(`tickers.${symbol}`, "linear");
        this.wsClient.on("update", (data: any) => {
            const tick = data?.data?.[0];
            if (tick?.lastPrice) {
                onPrice(Number(tick.lastPrice));
            }
        });
    }

    stopTickerStream(): void {
        this.wsClient?.closeAll();
        this.wsClient = null;
    }
}
