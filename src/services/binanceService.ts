import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";
import WebSocket from "ws";
import { logger } from "./loggerService.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

const SPOT_BASE = "https://api.binance.com";
const FUTURES_BASE = "https://fapi.binance.com";

/** Binance rate limit: 1200 requests/min. We use 1100 as a safe threshold. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 1100;

export class BinanceService {
  private apiKey = "";
  private apiSecret = "";
  private spot: AxiosInstance;
  private futures: AxiosInstance;
  private ws: WebSocket | null = null;
  private accountWs: WebSocket | null = null;
  private listenKey: string | null = null;
  private listenKeyTimer: ReturnType<typeof setInterval> | null = null;
  private accountReconnectAttempts = 0;
  private mode: "spot" | "futures" = "spot";
  private reconnectAttempts = 0;
  private maxReconnectRetries = 5;
  private requestTimestamps: number[] = [];

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
    this.stopAccountStream();
    this.apiKey = "";
    this.apiSecret = "";
  }

  /** Simple rate limiter: waits if we've exceeded the safe request threshold. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    // Prune timestamps older than the window
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    if (this.requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      const oldest = this.requestTimestamps[0]!;
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest) + 50; // +50ms safety margin
      logger.warn("SYSTEM", `Binance rate limit approaching, waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      // Prune again after waiting
      const afterWait = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(
        (ts) => afterWait - ts < RATE_LIMIT_WINDOW_MS,
      );
    }
    this.requestTimestamps.push(Date.now());
  }

  private sign(params: Record<string, string | number>): string {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = crypto.createHmac("sha256", this.apiSecret).update(query).digest("hex");
    return `${query}&signature=${signature}`;
  }

  private async signedGet(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    await this.throttle();
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.get(`${path}?${query}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedPost(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    await this.throttle();
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.post(`${path}?${query}`, null, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedDelete(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    await this.throttle();
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
      // TODO: Currently only counts USDT balance. Multi-asset support would require
      // fetching prices for each asset and converting to a common denomination.
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

  /** Fetch the current bid/ask spread as a percentage for the given symbol. */
  async getSpread(symbol: string): Promise<number> {
    await this.throttle();
    const client = this.mode === "spot" ? this.spot : this.futures;
    const path = this.mode === "spot" ? "/api/v3/ticker/bookTicker" : "/fapi/v1/ticker/bookTicker";
    const { data } = await client.get(path, { params: { symbol } });
    const bid = parseFloat((data as { bidPrice: string }).bidPrice);
    const ask = parseFloat((data as { askPrice: string }).askPrice);
    if (bid <= 0 || ask <= 0) return 0;
    const mid = (ask + bid) / 2;
    return ((ask - bid) / mid) * 100;
  }

  /** Fetch all USDT trading pairs from the exchange. */
  async getSymbols(): Promise<string[]> {
    await this.throttle();
    if (this.mode === "spot") {
      const { data } = await this.spot.get("/api/v3/exchangeInfo");
      const info = data as { symbols: Array<{ symbol: string; status: string; quoteAsset: string }> };
      return info.symbols
        .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
        .map((s) => s.symbol)
        .sort();
    }
    const { data } = await this.futures.get("/fapi/v1/exchangeInfo");
    const info = data as { symbols: Array<{ symbol: string; status: string; quoteAsset: string }> };
    return info.symbols
      .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
      .map((s) => s.symbol)
      .sort();
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void, maxRetries = 5): void {
    this.reconnectAttempts = 0;
    this.maxReconnectRetries = maxRetries;
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
      if (this.reconnectAttempts < this.maxReconnectRetries) {
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
    this.reconnectAttempts = 0;
  }

  /** Start a private user data stream for real-time balance/position updates. */
  async startAccountStream(
    onPortfolio: (snap: PortfolioSnapshot) => void,
    onPositions: (positions: Position[]) => void,
  ): Promise<void> {
    this.stopAccountStream();
    this.accountReconnectAttempts = 0;

    const client = this.mode === "spot" ? this.spot : this.futures;
    const listenKeyPath = this.mode === "spot" ? "/api/v3/userDataStream" : "/fapi/v1/listenKey";

    // Create listenKey
    const { data } = await client.post(listenKeyPath, null, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    this.listenKey = (data as { listenKey: string }).listenKey;

    // Keep-alive every 30 minutes
    this.listenKeyTimer = setInterval(async () => {
      try {
        await client.put(listenKeyPath, null, {
          headers: { "X-MBX-APIKEY": this.apiKey },
          params: { listenKey: this.listenKey },
        });
      } catch (err) {
        logger.warn("SYSTEM", `Binance listenKey keep-alive failed: ${err}`);
      }
    }, 30 * 60_000);

    const baseUrl = this.mode === "spot"
      ? "wss://stream.binance.com:9443/ws"
      : "wss://fstream.binance.com/ws";

    this.connectAccountWs(`${baseUrl}/${this.listenKey}`, onPortfolio, onPositions);
  }

  private connectAccountWs(
    url: string,
    onPortfolio: (snap: PortfolioSnapshot) => void,
    onPositions: (positions: Position[]) => void,
  ): void {
    this.accountWs = new WebSocket(url);

    this.accountWs.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { e: string; [key: string]: unknown };

        if (this.mode === "spot" && msg.e === "outboundAccountPosition") {
          // Spot: balance update
          const balances = (msg as any).B as Array<{ a: string; f: string; l: string }>;
          const usdt = balances.find((b) => b.a === "USDT");
          if (usdt) {
            const free = parseFloat(usdt.f);
            const locked = parseFloat(usdt.l);
            onPortfolio({
              totalBalance: free + locked,
              availableBalance: free,
              dailyPnl: 0,
              weeklyPnl: 0,
            });
          }
        } else if (this.mode === "futures" && msg.e === "ACCOUNT_UPDATE") {
          // Futures: balance + position update
          const account = (msg as any).a as {
            B: Array<{ a: string; wb: string; cw: string }>;
            P: Array<{ s: string; pa: string; ep: string; mp: string; up: string }>;
          };
          const usdt = account.B.find((b) => b.a === "USDT");
          if (usdt) {
            onPortfolio({
              totalBalance: parseFloat(usdt.wb),
              availableBalance: parseFloat(usdt.cw),
              dailyPnl: 0,
              weeklyPnl: 0,
            });
          }
          const positions = account.P
            .filter((p) => parseFloat(p.pa) !== 0)
            .map((p) => ({
              symbol: p.s,
              side: parseFloat(p.pa) > 0 ? ("BUY" as const) : ("SELL" as const),
              entryPrice: parseFloat(p.ep),
              markPrice: parseFloat(p.mp),
              quantity: Math.abs(parseFloat(p.pa)),
              unrealizedPnl: parseFloat(p.up),
              liquidationPrice: null,
            }));
          onPositions(positions);
        }

        this.accountReconnectAttempts = 0;
      } catch {
        /* ignore malformed messages */
      }
    });

    this.accountWs.on("close", () => {
      if (this.accountReconnectAttempts < 5) {
        this.accountReconnectAttempts++;
        const delay = Math.pow(2, this.accountReconnectAttempts - 1) * 1000;
        logger.warn("SYSTEM", `Binance account stream closed, reconnecting in ${delay}ms`);
        setTimeout(() => this.connectAccountWs(url, onPortfolio, onPositions), delay);
      } else {
        logger.error("SYSTEM", "Binance account stream failed after max retries");
      }
    });

    this.accountWs.on("error", (err: Error) => {
      logger.error("SYSTEM", `Binance account stream error: ${err.message}`);
    });
  }

  stopAccountStream(): void {
    if (this.listenKeyTimer) {
      clearInterval(this.listenKeyTimer);
      this.listenKeyTimer = null;
    }
    if (this.accountWs) {
      this.accountWs.removeAllListeners();
      this.accountWs.close();
      this.accountWs = null;
    }
    this.listenKey = null;
    this.accountReconnectAttempts = 0;
  }
}
