import type { CandleBar } from "../shared/types.js";

const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
};

export class CandleAggregator {
  private candles: CandleBar[] = [];
  private currentCandle: CandleBar | null = null;
  private intervalMs: number;
  private maxCandles: number;

  constructor(timeframe: "1m" | "5m" | "15m", maxCandles = 250) {
    this.intervalMs = TIMEFRAME_MS[timeframe];
    this.maxCandles = maxCandles;
  }

  /** Feed a raw tick price + timestamp */
  addTick(price: number, timestamp: number): void {
    const candleStart = Math.floor(timestamp / this.intervalMs) * this.intervalMs;

    if (!this.currentCandle || this.currentCandle.timestamp !== candleStart) {
      // Close previous candle if it exists
      if (this.currentCandle) {
        this.candles.push({ ...this.currentCandle });
        if (this.candles.length > this.maxCandles) {
          this.candles.shift();
        }
      }
      // Start new candle
      this.currentCandle = {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 1,
        timestamp: candleStart,
      };
    } else {
      // Update current candle
      this.currentCandle.high = Math.max(this.currentCandle.high, price);
      this.currentCandle.low = Math.min(this.currentCandle.low, price);
      this.currentCandle.close = price;
      this.currentCandle.volume += 1;
    }
  }

  /** Get all completed candles (not including the current building candle) */
  getCandles(): CandleBar[] {
    return [...this.candles];
  }

  /** Get completed candles + current building candle */
  getAllIncludingCurrent(): CandleBar[] {
    if (!this.currentCandle) return [...this.candles];
    return [...this.candles, { ...this.currentCandle }];
  }

  /** Get closing prices from completed candles */
  getClosePrices(): number[] {
    return this.candles.map((c) => c.close);
  }

  /** Get the most recent N candles for AI context */
  getRecentCandles(n: number): CandleBar[] {
    return this.candles.slice(-n);
  }

  /** Number of completed candles */
  get length(): number {
    return this.candles.length;
  }

  /** Reset all data */
  reset(): void {
    this.candles = [];
    this.currentCandle = null;
  }
}
