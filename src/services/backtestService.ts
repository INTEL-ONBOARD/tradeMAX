import axios from "axios";
import { RSI, MACD, EMA, BollingerBands } from "technicalindicators";
import { getAIDecision } from "./aiService.js";
import { validateTrade, type RiskOptions } from "./riskEngine.js";
import { logger } from "./loggerService.js";
import { ENGINE } from "../shared/constants.js";
import type { AIDecision, AIPromptData, CandleBar, RiskProfile, EngineConfig } from "../shared/types.js";

export interface BacktestConfig {
  symbol: string;
  exchange: "bybit";
  mode: "spot" | "futures";
  startDate: string; // ISO date
  endDate: string;   // ISO date
  startingBalance: number;
  riskProfile: RiskProfile;
  engineConfig: EngineConfig;
  claudeApiKey?: string;
}

export interface BacktestTrade {
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  reason: "STOP_LOSS" | "TAKE_PROFIT";
  entryTime: string;
  exitTime: string;
  aiConfidence: number;
}

export interface BacktestResult {
  symbol: string;
  period: string;
  startingBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: BacktestTrade[];
}

type BacktestCallback = (progress: { current: number; total: number; status: string }) => void;

/** Map our internal timeframe names to Bybit interval values. */
function toBybitInterval(tf: string): string {
  const map: Record<string, string> = { "1m": "1", "5m": "5", "15m": "15" };
  return map[tf] ?? "1";
}

async function fetchHistoricalCandles(
  symbol: string,
  startDate: string,
  endDate: string,
  interval = "1m",
): Promise<CandleBar[]> {
  const candles: CandleBar[] = [];
  const bybitInterval = toBybitInterval(interval);
  let endMs = new Date(endDate).getTime();
  const startMs = new Date(startDate).getTime();

  // Bybit V5 kline returns newest-first; we paginate backwards from endDate
  while (endMs > startMs) {
    const url = `https://api.bybit.com/v5/market/kline`;
    const { data } = await axios.get(url, {
      params: {
        category: "linear",
        symbol,
        interval: bybitInterval,
        start: startMs,
        end: endMs,
        limit: 200, // Bybit max per request
      },
    });

    const resp = data as { retCode: number; result: { list: string[][] } };
    const list = resp.result?.list;
    if (!list || list.length === 0) break;

    // Bybit returns [startTime, open, high, low, close, volume, turnover] newest-first
    for (const k of list) {
      const ts = parseInt(k[0], 10);
      if (ts < startMs) continue;
      candles.push({
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        timestamp: ts,
      });
    }

    // Move the end cursor to just before the oldest candle in this batch
    const oldestTs = parseInt(list[list.length - 1][0], 10);
    if (oldestTs >= endMs) break; // no progress, avoid infinite loop
    endMs = oldestTs - 1;
  }

  // Sort ascending by timestamp (Bybit returns newest-first)
  candles.sort((a, b) => a.timestamp - b.timestamp);

  // Deduplicate by timestamp
  const seen = new Set<number>();
  const unique: CandleBar[] = [];
  for (const c of candles) {
    if (!seen.has(c.timestamp)) {
      seen.add(c.timestamp);
      unique.push(c);
    }
  }

  return unique;
}

export async function runBacktest(
  config: BacktestConfig,
  onProgress?: BacktestCallback,
): Promise<BacktestResult> {
  onProgress?.({ current: 0, total: 100, status: "Fetching historical data..." });

  const candles = await fetchHistoricalCandles(
    config.symbol,
    config.startDate,
    config.endDate,
    config.engineConfig.candleTimeframe,
  );

  if (candles.length < ENGINE.MIN_BARS_FOR_INDICATORS) {
    throw new Error(`Not enough candles: got ${candles.length}, need ${ENGINE.MIN_BARS_FOR_INDICATORS}`);
  }

  onProgress?.({ current: 10, total: 100, status: `Processing ${candles.length} candles...` });

  let balance = config.startingBalance;
  let peakBalance = balance;
  let maxDrawdown = 0;
  const trades: BacktestTrade[] = [];
  let openTrade: { side: "BUY" | "SELL"; entry: number; qty: number; sl: number; tp: number; confidence: number; entryTime: string } | null = null;

  const windowSize = Math.max(ENGINE.MIN_BARS_FOR_INDICATORS + 10, 50);

  for (let i = windowSize; i < candles.length; i++) {
    const window = candles.slice(Math.max(0, i - 250), i + 1);
    const currentCandle = candles[i];
    const currentPrice = currentCandle.close;
    const closePrices = window.map((c) => c.close);

    // Check SL/TP on open trade
    if (openTrade) {
      let hitSL = false;
      let hitTP = false;

      if (openTrade.side === "BUY") {
        hitSL = currentCandle.low <= openTrade.sl;
        hitTP = currentCandle.high >= openTrade.tp;
      } else {
        hitSL = currentCandle.high >= openTrade.sl;
        hitTP = currentCandle.low <= openTrade.tp;
      }

      if (hitSL || hitTP) {
        const exitPrice = hitSL ? openTrade.sl : openTrade.tp;
        const pnl = openTrade.side === "BUY"
          ? (exitPrice - openTrade.entry) * openTrade.qty
          : (openTrade.entry - exitPrice) * openTrade.qty;

        balance += pnl;
        trades.push({
          side: openTrade.side,
          entryPrice: openTrade.entry,
          exitPrice,
          quantity: openTrade.qty,
          pnl,
          reason: hitSL ? "STOP_LOSS" : "TAKE_PROFIT",
          entryTime: openTrade.entryTime,
          exitTime: new Date(currentCandle.timestamp).toISOString(),
          aiConfidence: openTrade.confidence,
        });
        openTrade = null;
      }
    }

    // Skip if we already have an open trade
    if (openTrade) continue;

    // Only run AI every Nth candle to avoid excessive API calls
    if (i % 5 !== 0) continue;

    // Calculate indicators
    const rsiValues = RSI.calculate({ values: closePrices, period: ENGINE.RSI_PERIOD });
    const rsi = rsiValues[rsiValues.length - 1] ?? 50;

    const macdResult = MACD.calculate({
      values: closePrices,
      fastPeriod: ENGINE.MACD_FAST,
      slowPeriod: ENGINE.MACD_SLOW,
      signalPeriod: ENGINE.MACD_SIGNAL,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const macdRaw = macdResult[macdResult.length - 1];
    const macd = macdRaw ?? { MACD: 0, signal: 0, histogram: 0 };

    let ema: { ema12: number; ema26: number } | undefined;
    if (config.engineConfig.enableEMA && closePrices.length >= 26) {
      const e12 = EMA.calculate({ values: closePrices, period: 12 });
      const e26 = EMA.calculate({ values: closePrices, period: 26 });
      ema = { ema12: e12[e12.length - 1] ?? 0, ema26: e26[e26.length - 1] ?? 0 };
    }

    let bollingerBands: { upper: number; middle: number; lower: number } | undefined;
    if (config.engineConfig.enableBollingerBands && closePrices.length >= 20) {
      const bbResult = BollingerBands.calculate({ values: closePrices, period: 20, stdDev: 2 });
      const bb = bbResult[bbResult.length - 1];
      if (bb) bollingerBands = { upper: bb.upper, middle: bb.middle, lower: bb.lower };
    }

    const recentCandles = window.slice(-10);
    const recentTradeOutcomes = trades.slice(-5).map((t) => ({
      side: t.side,
      pnl: t.pnl,
      reason: t.reason,
    }));

    const promptData: AIPromptData = {
      symbol: config.symbol,
      exchange: config.exchange,
      mode: config.mode,
      currentPrice,
      indicators: { rsi, macd: { line: macd.MACD ?? 0, signal: macd.signal ?? 0, histogram: macd.histogram ?? 0 }, ema, bollingerBands },
      recentCandles,
      recentTradeOutcomes,
      spread: 0.05,
      portfolio: { totalBalance: balance, availableBalance: balance, dailyPnl: 0, weeklyPnl: 0 },
      openPositions: [],
      riskProfile: config.riskProfile,
    };

    // Get AI decision
    let decision: AIDecision;
    try {
      decision = await getAIDecision(promptData, config.claudeApiKey, config.engineConfig.aiModel, 0);
    } catch {
      continue;
    }

    if (decision.decision === "HOLD") continue;

    // Validate SL/TP contract
    if (decision.decision === "BUY" && (decision.stop_loss >= decision.entry || decision.take_profit <= decision.entry)) continue;
    if (decision.decision === "SELL" && (decision.stop_loss <= decision.entry || decision.take_profit >= decision.entry)) continue;

    // Position sizing
    const riskAmount = balance * (config.riskProfile.maxRiskPct / 100);
    const slDistance = Math.abs(decision.entry - decision.stop_loss);
    if (slDistance <= 0) continue;
    const quantity = riskAmount / slDistance;

    // Simple risk check (skip full engine for performance)
    if (decision.confidence < config.riskProfile.minConfidence) continue;

    openTrade = {
      side: decision.decision as "BUY" | "SELL",
      entry: currentPrice,
      qty: quantity,
      sl: decision.stop_loss,
      tp: decision.take_profit,
      confidence: decision.confidence,
      entryTime: new Date(currentCandle.timestamp).toISOString(),
    };

    // Track drawdown
    if (balance > peakBalance) peakBalance = balance;
    const dd = ((peakBalance - balance) / peakBalance) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;

    onProgress?.({
      current: 10 + Math.round(((i - windowSize) / (candles.length - windowSize)) * 85),
      total: 100,
      status: `Processed ${i}/${candles.length} candles, ${trades.length} trades...`,
    });
  }

  // Close any remaining open trade at last price
  if (openTrade) {
    const lastPrice = candles[candles.length - 1].close;
    const pnl = openTrade.side === "BUY"
      ? (lastPrice - openTrade.entry) * openTrade.qty
      : (openTrade.entry - lastPrice) * openTrade.qty;
    balance += pnl;
    trades.push({
      side: openTrade.side,
      entryPrice: openTrade.entry,
      exitPrice: lastPrice,
      quantity: openTrade.qty,
      pnl,
      reason: "STOP_LOSS",
      entryTime: openTrade.entryTime,
      exitTime: new Date(candles[candles.length - 1].timestamp).toISOString(),
      aiConfidence: openTrade.confidence,
    });
  }

  // Calculate final metrics
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const returns = trades.map((t) => t.pnl);
  const meanR = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const varR = returns.length > 0 ? returns.reduce((s, r) => s + Math.pow(r - meanR, 2), 0) / returns.length : 0;
  const sharpeRatio = Math.sqrt(varR) > 0 ? (meanR / Math.sqrt(varR)) * Math.sqrt(252) : 0;

  onProgress?.({ current: 100, total: 100, status: "Backtest complete!" });

  return {
    symbol: config.symbol,
    period: `${config.startDate} to ${config.endDate}`,
    startingBalance: config.startingBalance,
    finalBalance: balance,
    totalTrades: trades.length,
    winRate,
    totalPnl: balance - config.startingBalance,
    maxDrawdown,
    sharpeRatio,
    profitFactor: profitFactor === Infinity ? 999 : profitFactor,
    trades,
  };
}
