import { RestClientV5, WebsocketClient } from "bybit-api";
import { logger } from "./loggerService.js";
import { notificationService } from "./notificationService.js";
import type {
  ExchangeKeys,
  ExchangeSymbolMetadata,
  MarketTick,
  OrderResult,
  PortfolioSnapshot,
  Position,
} from "../shared/types.js";

export class BybitService {
  private rest: RestClientV5 | null = null;
  private wsClient: WebsocketClient | null = null;
  private accountWsClient: WebsocketClient | null = null;
  private mode: "spot" | "futures" = "spot";
  private apiKey = "";
  private apiSecret = "";
  private accountStreamDisconnected = false;

  async initialize(keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    if (!keys.apiKey || !keys.apiSecret) {
      throw new Error("Missing Bybit API credentials");
    }

    this.apiKey = keys.apiKey;
    this.apiSecret = keys.apiSecret;
    this.mode = mode;

    this.rest = new RestClientV5({ key: this.apiKey, secret: this.apiSecret });
  }

  destroy(): void {
    this.stopTickerStream();
    this.stopAccountStream();
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

    // Bybit UNIFIED accounts often return empty strings for totalAvailableBalance
    // and per-coin availableToWithdraw. Calculate from USDT: equity - totalPositionIM
    let available = parseFloat(account.totalAvailableBalance || "0") || 0;
    if (available === 0) {
      const coins = (account as any).coin as Array<{
        coin: string;
        equity: string;
        totalPositionIM: string;
        availableToWithdraw: string;
      }>| undefined;
      const usdt = coins?.find((c) => c.coin === "USDT");
      if (usdt) {
        const withdraw = parseFloat(usdt.availableToWithdraw || "0") || 0;
        if (withdraw > 0) {
          available = withdraw;
        } else {
          // Calculate: equity - margin used by positions
          const equity = parseFloat(usdt.equity || "0") || 0;
          const positionIM = parseFloat(usdt.totalPositionIM || "0") || 0;
          available = Math.max(0, equity - positionIM);
        }
      }
    }

    return {
      totalBalance: parseFloat(account.totalEquity || "0") || 0,
      availableBalance: available,
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

  /** Fetch closed PnL history from Bybit for equity curve and performance metrics. */
  async getClosedPnl(limit = 100): Promise<Array<{
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    closedAt: string;
  }>> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const category = this.getCategory();
    if (category === "spot") return [];

    const { result } = await this.rest.getClosedPnL({ category, limit });
    return (result.list ?? []).map((p: any) => ({
      symbol: p.symbol,
      side: p.side === "Buy" ? ("BUY" as const) : ("SELL" as const),
      quantity: parseFloat(p.qty || "0") || 0,
      entryPrice: parseFloat(p.avgEntryPrice || "0") || 0,
      exitPrice: parseFloat(p.avgExitPrice || "0") || 0,
      pnl: parseFloat(p.closedPnl || "0") || 0,
      closedAt: new Date(parseInt(p.updatedTime || "0")).toISOString(),
    }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const category = this.getCategory();
    const { result } = await this.rest.submitOrder({
      category,
      symbol,
      side: side === "BUY" ? "Buy" : "Sell",
      orderType: "Market",
      qty: quantity.toString(),
    });

    const orderId = result.orderId;

    // Attempt to fetch the actual execution price from order history
    let fillPrice = 0;
    try {
      const { result: historyResult } = await this.rest.getHistoricOrders({
        category,
        symbol,
        orderId,
        limit: 1,
      });
      const order = historyResult.list?.[0];
      if (order && parseFloat(order.avgPrice) > 0) {
        fillPrice = parseFloat(order.avgPrice);
      }
    } catch (err: unknown) {
      logger.warn("SYSTEM", `Bybit: failed to fetch fill price for order ${orderId}, returning 0`);
    }

    return {
      orderId,
      symbol,
      side,
      quantity,
      price: fillPrice,
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

  /** Fetch the current bid/ask spread as a percentage for the given symbol. */
  async getSpread(symbol: string): Promise<number> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const category = this.getCategory();
    const { result } = await this.rest.getOrderbook({ category, symbol, limit: 1 });
    const bid = result.b?.[0]?.[0] ? parseFloat(result.b[0][0]) : 0;
    const ask = result.a?.[0]?.[0] ? parseFloat(result.a[0][0]) : 0;
    if (bid <= 0 || ask <= 0) return 0;
    const mid = (ask + bid) / 2;
    return ((ask - bid) / mid) * 100;
  }

  /** Fetch all USDT trading pairs from the exchange. */
  async getSymbols(): Promise<string[]> {
    if (!this.rest) throw new Error("Bybit not initialized");
    const category = this.getCategory();
    const { result } = await this.rest.getInstrumentsInfo({ category, limit: 1000 });
    return (result.list ?? [])
      .filter((i: { status: string; quoteCoin: string }) => i.status === "Trading" && i.quoteCoin === "USDT")
      .map((i: { symbol: string }) => i.symbol)
      .sort();
  }

  async getSymbolMetadata(symbols?: string[]): Promise<ExchangeSymbolMetadata[]> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const category = this.getCategory();
    const { result } = await this.rest.getInstrumentsInfo({ category, limit: 1000 });
    const allowed = symbols && symbols.length > 0
      ? new Set(symbols.map((symbol) => symbol.toUpperCase()))
      : null;

    return (result.list ?? [])
      .filter((item: any) => item.status === "Trading" && item.quoteCoin === "USDT")
      .filter((item: any) => !allowed || allowed.has(String(item.symbol).toUpperCase()))
      .map((item: any): ExchangeSymbolMetadata => {
        const lotSize = item.lotSizeFilter ?? {};
        const priceFilter = item.priceFilter ?? {};
        const qtyStep =
          parseFloat(lotSize.qtyStep ?? lotSize.basePrecision ?? "0") ||
          parseFloat(lotSize.minOrderQty ?? "0") ||
          0.001;
        const minOrderQty = parseFloat(lotSize.minOrderQty ?? "0") || qtyStep;
        const minNotionalUsd =
          parseFloat(lotSize.minOrderAmt ?? lotSize.minNotionalValue ?? "0") ||
          parseFloat(lotSize.minOrderQty ?? "0") * parseFloat(item.lastPrice ?? "0") ||
          5;

        return {
          symbol: String(item.symbol).toUpperCase(),
          mode: this.mode,
          qtyStep,
          minOrderQty,
          minNotionalUsd,
          priceTick: parseFloat(priceFilter.tickSize ?? "0") || 0.01,
          supportsShorts: this.mode === "futures",
        };
      });
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void, _maxRetries?: number): void {
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

  /** Start a private WebSocket stream for real-time balance/position updates. */
  startAccountStream(
    onPortfolio: (snap: PortfolioSnapshot) => void,
    onPositions: (positions: Position[]) => void,
  ): void {
    this.stopAccountStream();

    this.accountWsClient = new WebsocketClient({
      market: "v5",
      key: this.apiKey,
      secret: this.apiSecret,
    });

    // Subscribe to wallet updates (balance changes) — private topic
    const category = this.mode === "spot" ? "spot" : "linear";
    this.accountWsClient.subscribeV5("wallet", category, true);

    // Subscribe to position updates (futures only)
    if (this.mode === "futures") {
      this.accountWsClient.subscribeV5("position", category, true);
    }

    this.accountWsClient.on("update", (msg: { topic: string; data: any }) => {
      try {
        if (msg.topic === "wallet") {
          const coins = msg.data as Array<{
            coin: Array<{ coin: string; equity: string; totalPositionIM: string; availableToWithdraw: string }>;
            totalEquity: string;
            totalAvailableBalance: string;
          }>;
          const account = coins[0];
          if (account) {
            let available = parseFloat(account.totalAvailableBalance || "0") || 0;
            if (available === 0) {
              const coinList = (account as any).coin as Array<{
                coin: string; equity: string; totalPositionIM: string; availableToWithdraw: string;
              }> | undefined;
              const usdt = coinList?.find((c) => c.coin === "USDT");
              if (usdt) {
                const withdraw = parseFloat(usdt.availableToWithdraw || "0") || 0;
                if (withdraw > 0) {
                  available = withdraw;
                } else {
                  const equity = parseFloat(usdt.equity || "0") || 0;
                  const positionIM = parseFloat(usdt.totalPositionIM || "0") || 0;
                  available = Math.max(0, equity - positionIM);
                }
              }
            }
            onPortfolio({
              totalBalance: parseFloat(account.totalEquity || "0") || 0,
              availableBalance: available,
              dailyPnl: 0,
              weeklyPnl: 0,
            });
          }
        } else if (msg.topic === "position") {
          const positions = (msg.data as Array<{
            symbol: string;
            side: string;
            size: string;
            avgPrice: string;
            markPrice: string;
            unrealisedPnl: string;
            liqPrice: string;
          }>)
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
          onPositions(positions);
        }
      } catch {
        /* ignore malformed messages */
      }
    });

    this.accountWsClient.on("exception", (err: { message?: string }) => {
      // Log but do NOT call closeAll() — let the bybit-api library handle reconnection
      logger.warn("SYSTEM", `Bybit account stream exception (library will auto-reconnect): ${err?.message ?? String(err)}`);
    });

    this.accountWsClient.on("reconnected", () => {
      logger.info("SYSTEM", "Bybit account stream reconnected successfully");
      if (this.accountStreamDisconnected) {
        notificationService.notify({
          type: "system",
          title: "Live account stream restored",
          message: "Bybit account updates are flowing again.",
          desktop: "never",
        });
      }
      this.accountStreamDisconnected = false;
    });

    this.accountWsClient.on("close", () => {
      logger.warn("SYSTEM", "Bybit account stream closed — library will attempt auto-reconnect");
      if (!this.accountStreamDisconnected) {
        notificationService.notify({
          type: "system",
          title: "Live account stream interrupted",
          message: "Bybit account updates paused. Auto-reconnect is in progress.",
          desktop: "never",
        });
      }
      this.accountStreamDisconnected = true;
    });
  }

  stopAccountStream(): void {
    if (this.accountWsClient) {
      try {
        this.accountWsClient.closeAll();
      } catch {
        /* ignore cleanup errors */
      }
      this.accountWsClient = null;
    }
    this.accountStreamDisconnected = false;
  }
}
