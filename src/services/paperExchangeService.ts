import WebSocket from "ws";
import { logger } from "./loggerService.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

const POPULAR_PAIRS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
  "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT", "LTCUSDT",
];

interface VirtualPosition {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
}

interface SharedPaperState {
  startingBalance: number;
  virtualBalance: number;
  positions: VirtualPosition[];
  lastPrice: number;
  mode: "spot" | "futures";
  leverage: number;
  initialized: boolean;
}

const DEFAULT_PAPER_BALANCE = 10000;

const sharedState: SharedPaperState = {
  startingBalance: DEFAULT_PAPER_BALANCE,
  virtualBalance: DEFAULT_PAPER_BALANCE,
  positions: [],
  lastPrice: 0,
  mode: "spot",
  leverage: 1,
  initialized: false,
};

export class PaperExchangeService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectRetries = 5;

  setStartingBalance(balance: number): void {
    // Only rewrite the live paper balance when the simulation has not yet started,
    // or when it is still at the untouched starting state.
    const untouched =
      sharedState.positions.length === 0 &&
      Math.abs(sharedState.virtualBalance - sharedState.startingBalance) < 0.000001;

    sharedState.startingBalance = balance;

    if (!sharedState.initialized || untouched) {
      sharedState.virtualBalance = balance;
      sharedState.initialized = true;
    }
  }

  async initialize(_keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    sharedState.mode = mode;
    if (!sharedState.initialized) {
      sharedState.initialized = true;
    }
  }

  destroy(): void {
    this.stopTickerStream();
  }

  async getBalance(): Promise<PortfolioSnapshot> {
    const unrealized = sharedState.positions.reduce((sum, p) => {
      const pnl = p.side === "BUY"
        ? (sharedState.lastPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - sharedState.lastPrice) * p.quantity;
      return sum + pnl;
    }, 0);
    const total = sharedState.virtualBalance + unrealized;
    return { totalBalance: total, availableBalance: sharedState.virtualBalance, dailyPnl: 0, weeklyPnl: 0 };
  }

  async getOpenPositions(): Promise<Position[]> {
    return sharedState.positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      entryPrice: p.entryPrice,
      markPrice: sharedState.lastPrice,
      quantity: p.quantity,
      unrealizedPnl: p.side === "BUY"
        ? (sharedState.lastPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - sharedState.lastPrice) * p.quantity,
      liquidationPrice: null,
    }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const slippagePct = Math.random() * 0.0005;
    const fillPrice = side === "BUY"
      ? sharedState.lastPrice * (1 + slippagePct)
      : sharedState.lastPrice * (1 - slippagePct);

    const cost = fillPrice * quantity;
    if (sharedState.virtualBalance < cost && sharedState.mode === "spot") {
      throw new Error("Insufficient virtual balance");
    }

    sharedState.positions.push({ symbol, side, quantity, entryPrice: fillPrice });
    if (sharedState.mode === "spot") {
      sharedState.virtualBalance -= cost;
    }

    await logger.info("TRADE", `[PAPER] ${side} ${quantity} ${symbol} @ $${fillPrice.toFixed(2)}`);

    return {
      orderId: `paper-${Date.now()}`,
      symbol,
      side,
      quantity,
      price: fillPrice,
      status: "FILLED",
    };
  }

  async closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const idx = sharedState.positions.findIndex((p) => p.symbol === symbol && p.side === side);
    if (idx === -1) throw new Error("Paper position not found");

    const pos = sharedState.positions[idx];
    const slippagePct = Math.random() * 0.0005;
    const fillPrice = side === "BUY"
      ? sharedState.lastPrice * (1 - slippagePct)
      : sharedState.lastPrice * (1 + slippagePct);

    const pnl = side === "BUY"
      ? (fillPrice - pos.entryPrice) * quantity
      : (pos.entryPrice - fillPrice) * quantity;

    if (sharedState.mode === "spot") {
      // Restore original cost (entryPrice * quantity) plus PnL
      sharedState.virtualBalance += pos.entryPrice * quantity + pnl;
    } else {
      // Futures: just add PnL (no cost was deducted when opening)
      sharedState.virtualBalance += pnl;
    }
    sharedState.positions.splice(idx, 1);

    await logger.info("TRADE", `[PAPER] Closed ${side} ${symbol} PnL: $${pnl.toFixed(2)}`);

    return {
      orderId: `paper-close-${Date.now()}`,
      symbol,
      side: side === "BUY" ? "SELL" : "BUY",
      quantity,
      price: fillPrice,
      status: "FILLED",
    };
  }

  async cancelAllOrders(): Promise<void> { /* no-op */ }

  async setLeverage(_symbol: string, leverage: number): Promise<void> {
    sharedState.leverage = leverage;
  }

  async getSpread(_symbol: string): Promise<number> {
    return 0.05;
  }

  async getSymbols(): Promise<string[]> {
    return [...POPULAR_PAIRS];
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void, maxRetries = 5): void {
    this.stopTickerStream();
    this.reconnectAttempts = 0;
    this.maxReconnectRetries = maxRetries;
    const url = `wss://stream.bybit.com/v5/public/spot`;
    this.connectWs(url, symbol, callback);
  }

  private connectWs(url: string, symbol: string, callback: (tick: MarketTick) => void): void {
    this.ws = new WebSocket(url);

    this.ws.on("open", () => {
      // Subscribe to Bybit ticker stream
      this.ws?.send(JSON.stringify({
        op: "subscribe",
        args: [`tickers.${symbol}`],
      }));
    });

    this.ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          topic?: string;
          ts?: number;
          data?: { lastPrice?: string };
        };
        if (msg.topic?.startsWith("tickers.") && msg.data?.lastPrice) {
          sharedState.lastPrice = parseFloat(msg.data.lastPrice);
          callback({ symbol, price: sharedState.lastPrice, timestamp: msg.ts ?? Date.now() });
          this.reconnectAttempts = 0;
        }
      } catch { /* ignore malformed messages */ }
    });

    this.ws.on("close", () => {
      if (this.reconnectAttempts < this.maxReconnectRetries) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
        logger.warn("SYSTEM", `[PAPER] WebSocket closed, reconnecting in ${delay}ms`);
        setTimeout(() => this.connectWs(url, symbol, callback), delay);
      }
    });

    this.ws.on("error", (err: Error) => {
      logger.error("SYSTEM", `[PAPER] WebSocket error: ${err.message}`);
    });
  }

  stopTickerStream(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }
}
