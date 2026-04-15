import axios from "axios";
import crypto from "node:crypto";
import WebSocket, { type RawData } from "ws";
import { type Position, type TradeMode } from "../shared/types.js";

const BINANCE_SPOT_BASE = "https://api.binance.com";
const BINANCE_FUTURES_BASE = "https://fapi.binance.com";

export class BinanceService {
    private ws: WebSocket | null = null;

    constructor(private apiKey: string, private apiSecret: string) { }

    private sign(query: string): string {
        return crypto.createHmac("sha256", this.apiSecret).update(query).digest("hex");
    }

    private async signedGet(path: string, params: Record<string, string | number>, mode: TradeMode) {
        const base = mode === "futures" ? BINANCE_FUTURES_BASE : BINANCE_SPOT_BASE;
        const timestamp = Date.now();
        const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), timestamp: String(timestamp) }).toString();
        const signature = this.sign(query);
        const url = `${base}${path}?${query}&signature=${signature}`;
        return axios.get(url, { headers: { "X-MBX-APIKEY": this.apiKey } });
    }

    async getAccountBalance(mode: TradeMode): Promise<number> {
        if (!this.apiKey || !this.apiSecret) {
            return 0;
        }
        if (mode === "futures") {
            const res = await this.signedGet("/fapi/v2/balance", {}, mode);
            const usdt = res.data.find((x: any) => x.asset === "USDT");
            return Number(usdt?.balance || 0);
        }

        const res = await this.signedGet("/api/v3/account", {}, mode);
        const usdt = res.data.balances.find((x: any) => x.asset === "USDT");
        return Number(usdt?.free || 0);
    }

    async getOpenPositions(mode: TradeMode): Promise<Position[]> {
        if (!this.apiKey || !this.apiSecret || mode !== "futures") {
            return [];
        }
        const res = await this.signedGet("/fapi/v2/positionRisk", {}, "futures");
        return res.data
            .filter((p: any) => Number(p.positionAmt) !== 0)
            .map((p: any) => ({
                exchange: "binance",
                symbol: p.symbol,
                side: Number(p.positionAmt) > 0 ? "LONG" : "SHORT",
                quantity: Math.abs(Number(p.positionAmt)),
                entryPrice: Number(p.entryPrice),
                markPrice: Number(p.markPrice),
                liquidationPrice: Number(p.liquidationPrice),
                unrealizedPnl: Number(p.unRealizedProfit)
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
            throw new Error("Binance API keys not configured");
        }
        const base = input.mode === "futures" ? BINANCE_FUTURES_BASE : BINANCE_SPOT_BASE;
        const path = input.mode === "futures" ? "/fapi/v1/order" : "/api/v3/order";

        if (input.mode === "futures" && input.leverage) {
            const levParams = new URLSearchParams({ symbol: input.symbol, leverage: String(input.leverage), timestamp: String(Date.now()) });
            const levSig = this.sign(levParams.toString());
            await axios.post(`${BINANCE_FUTURES_BASE}/fapi/v1/leverage?${levParams.toString()}&signature=${levSig}`, null, {
                headers: { "X-MBX-APIKEY": this.apiKey }
            });
        }

        const params = new URLSearchParams({
            symbol: input.symbol,
            side: input.side,
            type: "MARKET",
            quantity: String(input.quantity),
            timestamp: String(Date.now())
        });

        const sig = this.sign(params.toString());
        const res = await axios.post(`${base}${path}?${params.toString()}&signature=${sig}`, null, {
            headers: { "X-MBX-APIKEY": this.apiKey }
        });
        return res.data;
    }

    async cancelAll(symbol: string, mode: TradeMode): Promise<void> {
        if (!this.apiKey || !this.apiSecret) {
            return;
        }
        if (mode === "futures") {
            const params = new URLSearchParams({ symbol, timestamp: String(Date.now()) });
            const sig = this.sign(params.toString());
            await axios.delete(`${BINANCE_FUTURES_BASE}/fapi/v1/allOpenOrders?${params.toString()}&signature=${sig}`, {
                headers: { "X-MBX-APIKEY": this.apiKey }
            });
        }
    }

    startTickerStream(symbol: string, onPrice: (price: number) => void): void {
        const stream = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;
        this.ws?.close();
        this.ws = new WebSocket(stream);
        this.ws.on("message", (raw: RawData) => {
            try {
                const data = JSON.parse(raw.toString());
                onPrice(Number(data.p));
            } catch {
                // no-op
            }
        });
    }

    stopTickerStream(): void {
        this.ws?.close();
        this.ws = null;
    }
}
