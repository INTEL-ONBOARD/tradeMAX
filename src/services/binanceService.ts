import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";
import WebSocket from "ws";
import { logger } from "./loggerService.js";
import { ENGINE } from "../shared/constants.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

const SPOT_BASE = "https://api.binance.com";
const FUTURES_BASE = "https://fapi.binance.com";

export class BinanceService {
  private apiKey = "";
  private apiSecret = "";
  private spot: AxiosInstance;
  private futures: AxiosInstance;
  private ws: WebSocket | null = null;
  private mode: "spot" | "futures" = "spot";
  private reconnectAttempts = 0;

  constructor() {
    this.spot = axios.create({ baseURL: SPOT_BASE });
    this.futures = axios.create({ baseURL: FUTURES_BASE });
  }

  async initialize(keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    this.apiKey = keys.apiKey;
    this.apiSecret = keys.apiSecret;
    this.mode = mode;
    this.reconnectAttempts = 0;
  }

  destroy(): void {
    this.stopTickerStream();
    this.apiKey = "";
    this.apiSecret = "";
  }

  private sign(params: Record<string, string | number>): string {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = crypto.createHmac("sha256", this.apiSecret).update(query).digest("hex");
    return `${query}&signature=${signature}`;
  }

  private async signedGet(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.get(`${path}?${query}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedPost(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.post(`${path}?${query}`, null, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedDelete(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.delete(`${path}?${query}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  async getBalance(): Promise<PortfolioSnapshot> {
    if (this.mode === "spot") {
      const data = (await this.signedGet(this.spot, "/api/v3/account")) as {
        balances: Array<{ asset: string; free: string; locked: string }>;
      };
      let total = 0;
      for (const b of data.balances) {
        const free = parseFloat(b.free);
        const locked = parseFloat(b.locked);
        if (b.asset === "USDT") total += free + locked;
      }
      return { totalBalance: total, availableBalance: total, dailyPnl: 0, weeklyPnl: 0 };
    }

    const data = (await this.signedGet(this.futures, "/fapi/v2/balance")) as Array<{
      asset: string;
      balance: string;
      availableBalance: string;
    }>;
    const usdt = data.find((b) => b.asset === "USDT");
    return {
      totalBalance: usdt ? parseFloat(usdt.balance) : 0,
      availableBalance: usdt ? parseFloat(usdt.availableBalance) : 0,
      dailyPnl: 0,
      weeklyPnl: 0,
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    if (this.mode === "spot") return [];

    const data = (await this.signedGet(this.futures, "/fapi/v2/positionRisk")) as Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
      unRealizedProfit: string;
      liquidationPrice: string;
    }>;

    return data
      .filter((p) => parseFloat(p.positionAmt) !== 0)
      .map((p) => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? ("BUY" as const) : ("SELL" as const),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        quantity: Math.abs(parseFloat(p.positionAmt)),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        liquidationPrice: parseFloat(p.liquidationPrice) || null,
      }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const client = this.mode === "spot" ? this.spot : this.futures;
    const path = this.mode === "spot" ? "/api/v3/order" : "/fapi/v1/order";

    const data = (await this.signedPost(client, path, {
      symbol,
      side,
      type: "MARKET",
      quantity: quantity.toString(),
    })) as { orderId: number; symbol: string; side: string; executedQty: string; avgPrice?: string; price?: string; status: string };

    return {
      orderId: data.orderId.toString(),
      symbol: data.symbol,
      side: data.side as "BUY" | "SELL",
      quantity: parseFloat(data.executedQty),
      price: parseFloat(data.avgPrice ?? data.price ?? "0"),
      status: data.status,
    };
  }

  async closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const closeSide = side === "BUY" ? "SELL" : "BUY";
    return this.placeMarketOrder(symbol, closeSide, quantity);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (this.mode === "spot") {
      if (symbol) {
        await this.signedDelete(this.spot, "/api/v3/openOrders", { symbol });
      }
    } else {
      if (symbol) {
        await this.signedDelete(this.futures, "/fapi/v1/allOpenOrders", { symbol });
      }
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.mode !== "futures") return;
    await this.signedPost(this.futures, "/fapi/v1/leverage", { symbol, leverage });
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void): void {
    this.stopTickerStream();
    const wsSymbol = symbol.toLowerCase();
    const baseUrl = this.mode === "spot" ? "wss://stream.binance.com:9443/ws" : "wss://fstream.binance.com/ws";
    const url = `${baseUrl}/${wsSymbol}@ticker`;

    this.connectWebSocket(url, symbol, callback);
  }

  private connectWebSocket(url: string, symbol: string, callback: (tick: MarketTick) => void): void {
    this.ws = new WebSocket(url);

    this.ws.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as { c: string; E: number };
        callback({ symbol, price: parseFloat(data.c), timestamp: data.E });
        this.reconnectAttempts = 0;
      } catch {
        /* ignore malformed messages */
      }
    });

    this.ws.on("close", () => {
      if (this.reconnectAttempts < ENGINE.WS_RECONNECT_RETRIES) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
        logger.warn("SYSTEM", `Binance WebSocket closed, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connectWebSocket(url, symbol, callback), delay);
      } else {
        logger.error("SYSTEM", "Binance WebSocket failed after max retries");
      }
    });

    this.ws.on("error", (err: Error) => {
      logger.error("SYSTEM", `Binance WebSocket error: ${err.message}`);
    });
  }

  stopTickerStream(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = ENGINE.WS_RECONNECT_RETRIES;
  }
}
