import WebSocket from "ws";
import { logger } from "./loggerService.js";
import type {
  ExchangeKeys,
  ExchangeSymbolMetadata,
  MarketTick,
  OrderResult,
  PortfolioSnapshot,
  Position,
} from "../shared/types.js";

const POPULAR_PAIRS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT",
  "ADAUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT", "LINKUSDT", "LTCUSDT",
];

interface VirtualPosition {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  leverage: number;
  reservedMargin: number;
  feesPaid: number;
  liquidationPrice: number | null;
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
const DEFAULT_MIN_NOTIONAL_USD = 5;
const PAPER_FEE_RATE = 0.0006;

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
    const reservedMargin = sharedState.positions.reduce((sum, p) => sum + p.reservedMargin, 0);
    const unrealized = sharedState.positions.reduce((sum, p) => {
      const pnl = p.side === "BUY"
        ? (sharedState.lastPrice - p.entryPrice) * p.quantity
        : (p.entryPrice - sharedState.lastPrice) * p.quantity;
      return sum + pnl;
    }, 0);
    const total = sharedState.virtualBalance + reservedMargin + unrealized;
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
      liquidationPrice: p.liquidationPrice,
    }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    if (!(sharedState.lastPrice > 0)) {
      throw new Error("Paper price feed unavailable");
    }

    const slippagePct = Math.random() * 0.0005;
    const fillPrice = side === "BUY"
      ? sharedState.lastPrice * (1 + slippagePct)
      : sharedState.lastPrice * (1 - slippagePct);

    const notional = fillPrice * quantity;
    if (notional < DEFAULT_MIN_NOTIONAL_USD) {
      throw new Error("Paper order below minimum notional");
    }

    if (sharedState.mode === "spot") {
      if (side === "SELL") {
        throw new Error("Paper spot mode only supports opening BUY positions");
      }
      const spotCost = notional + notional * PAPER_FEE_RATE;
      if (sharedState.virtualBalance < spotCost) {
        throw new Error("Insufficient virtual balance");
      }
      sharedState.virtualBalance -= spotCost;
    } else {
      const leverage = Math.max(1, sharedState.leverage || 1);
      const reservedMargin = notional / leverage;
      const upfrontCost = reservedMargin + notional * PAPER_FEE_RATE;
      if (sharedState.virtualBalance < upfrontCost) {
        throw new Error("Insufficient virtual margin");
      }
      sharedState.virtualBalance -= upfrontCost;
    }

    const leverage = Math.max(1, sharedState.leverage || 1);
    const reservedMargin = sharedState.mode === "futures" ? notional / leverage : 0;
    const liquidationBuffer = sharedState.mode === "futures" ? Math.max(0.5, (1 / leverage) * 0.92) : 0;
    const feesPaid = notional * PAPER_FEE_RATE;
    const liquidationPrice = sharedState.mode === "futures"
      ? side === "BUY"
        ? fillPrice * (1 - liquidationBuffer)
        : fillPrice * (1 + liquidationBuffer)
      : null;

    sharedState.positions.push({
      symbol,
      side,
      quantity,
      entryPrice: fillPrice,
      leverage,
      reservedMargin,
      feesPaid,
      liquidationPrice,
    });

    await logger.info("TRADE", `[PAPER] ${side} ${quantity} ${symbol} @ $${fillPrice.toFixed(2)}`, {
      mode: sharedState.mode,
      leverage,
      fee: feesPaid,
    });

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
    if (!(sharedState.lastPrice > 0)) throw new Error("Paper price feed unavailable");

    const pos = sharedState.positions[idx];
    const closeQuantity = Math.min(quantity, pos.quantity);
    const slippagePct = Math.random() * 0.0005;
    const fillPrice = side === "BUY"
      ? sharedState.lastPrice * (1 - slippagePct)
      : sharedState.lastPrice * (1 + slippagePct);

    const notional = fillPrice * closeQuantity;
    const exitFee = notional * PAPER_FEE_RATE;
    const pnl = side === "BUY"
      ? (fillPrice - pos.entryPrice) * closeQuantity
      : (pos.entryPrice - fillPrice) * closeQuantity;
    const marginShare = pos.quantity > 0 ? pos.reservedMargin * (closeQuantity / pos.quantity) : 0;

    if (sharedState.mode === "spot") {
      sharedState.virtualBalance += fillPrice * closeQuantity - exitFee;
    } else {
      sharedState.virtualBalance += marginShare + pnl - exitFee;
    }

    if (closeQuantity >= pos.quantity) {
      sharedState.positions.splice(idx, 1);
    } else {
      sharedState.positions[idx] = {
        ...pos,
        quantity: Number((pos.quantity - closeQuantity).toFixed(8)),
        reservedMargin: Math.max(0, pos.reservedMargin - marginShare),
        feesPaid: pos.feesPaid + exitFee,
      };
    }

    await logger.info("TRADE", `[PAPER] Closed ${side} ${symbol} PnL: $${pnl.toFixed(2)}`, {
      mode: sharedState.mode,
      fee: exitFee,
    });

    return {
      orderId: `paper-close-${Date.now()}`,
      symbol,
      side: side === "BUY" ? "SELL" : "BUY",
      quantity: closeQuantity,
      price: fillPrice,
      status: "FILLED",
    };
  }

  async cancelAllOrders(): Promise<void> { /* no-op */ }

  async setLeverage(_symbol: string, leverage: number): Promise<void> {
    sharedState.leverage = Math.max(1, leverage);
  }

  async getSpread(_symbol: string): Promise<number> {
    return sharedState.mode === "futures" ? 0.04 : 0.05;
  }

  async getSymbols(): Promise<string[]> {
    return [...POPULAR_PAIRS];
  }

  async getSymbolMetadata(symbols?: string[]): Promise<ExchangeSymbolMetadata[]> {
    const source = symbols && symbols.length > 0 ? symbols : [...POPULAR_PAIRS];
    return source.map((symbol) => ({
      symbol: symbol.toUpperCase(),
      mode: sharedState.mode,
      qtyStep: 0.001,
      minOrderQty: 0.001,
      minNotionalUsd: DEFAULT_MIN_NOTIONAL_USD,
      priceTick: 0.01,
      supportsShorts: sharedState.mode === "futures",
    }));
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void, maxRetries = 5): void {
    this.stopTickerStream();
    this.reconnectAttempts = 0;
    this.maxReconnectRetries = maxRetries;
    const url = sharedState.mode === "futures"
      ? "wss://stream.bybit.com/v5/public/linear"
      : "wss://stream.bybit.com/v5/public/spot";
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
