import { RestClientV5, WebsocketClient } from "bybit-api";
import { logger } from "./loggerService.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

export class BybitService {
  private rest: RestClientV5 | null = null;
  private wsClient: WebsocketClient | null = null;
  private mode: "spot" | "futures" = "spot";
  private apiKey = "";
  private apiSecret = "";

  async initialize(keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    this.apiKey = keys.apiKey;
    this.apiSecret = keys.apiSecret;
    this.mode = mode;

    this.rest = new RestClientV5({ key: this.apiKey, secret: this.apiSecret });
  }

  destroy(): void {
    this.stopTickerStream();
    this.rest = null;
    this.apiKey = "";
    this.apiSecret = "";
  }

  private getCategory(): "spot" | "linear" {
    return this.mode === "spot" ? "spot" : "linear";
  }

  async getBalance(): Promise<PortfolioSnapshot> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const { result } = await this.rest.getWalletBalance({ accountType: "UNIFIED" });
    const account = result.list?.[0];
    if (!account) return { totalBalance: 0, availableBalance: 0, dailyPnl: 0, weeklyPnl: 0 };

    return {
      totalBalance: parseFloat(account.totalEquity ?? "0"),
      availableBalance: parseFloat(account.totalAvailableBalance ?? "0"),
      dailyPnl: 0,
      weeklyPnl: 0,
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    if (!this.rest) throw new Error("Bybit not initialized");
    if (this.mode === "spot") return [];

    const { result } = await this.rest.getPositionInfo({
      category: "linear",
      settleCoin: "USDT",
    });

    return (result.list ?? [])
      .filter((p) => parseFloat(p.size) > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: p.side === "Buy" ? ("BUY" as const) : ("SELL" as const),
        entryPrice: parseFloat(p.avgPrice),
        markPrice: parseFloat(p.markPrice),
        quantity: parseFloat(p.size),
        unrealizedPnl: parseFloat(p.unrealisedPnl),
        liquidationPrice: parseFloat(p.liqPrice) || null,
      }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const { result } = await this.rest.submitOrder({
      category: this.getCategory(),
      symbol,
      side: side === "BUY" ? "Buy" : "Sell",
      orderType: "Market",
      qty: quantity.toString(),
    });

    return {
      orderId: result.orderId,
      symbol,
      side,
      quantity,
      price: 0,
      status: "FILLED",
    };
  }

  async closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const closeSide = side === "BUY" ? "SELL" : "BUY";
    return this.placeMarketOrder(symbol, closeSide, quantity);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (!this.rest) throw new Error("Bybit not initialized");

    await this.rest.cancelAllOrders({
      category: this.getCategory(),
      ...(symbol ? { symbol } : {}),
    });
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (!this.rest || this.mode !== "futures") return;

    try {
      await this.rest.setLeverage({
        category: "linear",
        symbol,
        buyLeverage: leverage.toString(),
        sellLeverage: leverage.toString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("leverage not modified")) throw err;
    }
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void): void {
    this.stopTickerStream();

    this.wsClient = new WebsocketClient({
      market: "v5",
      key: this.apiKey,
      secret: this.apiSecret,
    });

    const topic = `tickers.${symbol}`;
    this.wsClient.subscribeV5(topic, this.mode === "spot" ? "spot" : "linear");

    this.wsClient.on("update", (msg: { topic: string; data: { lastPrice: string } }) => {
      if (msg.topic === topic) {
        callback({
          symbol,
          price: parseFloat(msg.data.lastPrice),
          timestamp: Date.now(),
        });
      }
    });

    this.wsClient.on("exception", (err: { message?: string }) => {
      logger.error("SYSTEM", `Bybit WebSocket error: ${err?.message ?? String(err)}`);
    });
  }

  stopTickerStream(): void {
    if (this.wsClient) {
      try {
        this.wsClient.closeAll();
      } catch {
        /* ignore cleanup errors */
      }
      this.wsClient = null;
    }
  }
}
