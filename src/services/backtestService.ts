import axios from "axios";
import type {
  AgentCycleResult,
  BacktestRegimeBreakdown,
  BacktestResult,
  BacktestRunInput,
  BacktestTrade,
  CandleBar,
  EngineConfig,
  MarketSnapshot,
  PortfolioSnapshot,
  Position,
  RegimeState,
  TradingProfile,
  WalkForwardEvaluation,
  WalkForwardFoldResult,
} from "../shared/types.js";
import { ENGINE, TRADING_PROFILE_DEFAULTS } from "../shared/constants.js";
import { buildReplayMarketSnapshot } from "./marketSnapshotService.js";
import { runAIPipeline } from "./aiPipelineService.js";
import { logger } from "./loggerService.js";

type CandleMode = "spot" | "futures";

type RunPipelineFn = (args: {
  userId: string;
  snapshot: MarketSnapshot;
  engineConfig: EngineConfig;
  openaiApiKey?: string;
}) => Promise<AgentCycleResult>;

type CandleFetcherFn = (args: {
  symbol: string;
  timeframe: string;
  mode: CandleMode;
  start: number;
  end: number;
}) => Promise<CandleBar[]>;

export interface BacktestDependencies {
  fetchCandles: CandleFetcherFn;
  pipelineRunner: RunPipelineFn;
}

interface ReplayWindow {
  contextStartIndex: number;
  testStartIndex: number;
  endIndex: number;
  profile: TradingProfile;
  fold?: number;
}

interface OpenTradeState {
  side: "BUY" | "SELL";
  entryPrice: number;
  quantity: number;
  openedAt: string;
  openedIndex: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPct: number | null;
  maxHoldBars: number;
  bestPrice: number;
  worstPrice: number;
  profile: TradingProfile;
  regime: RegimeState;
  aiConfidence: number;
  entryBalance: number;
  latencyMs: number;
  fold?: number;
}

interface ClosedTradeState extends Omit<BacktestTrade, "profile" | "regime"> {
  profile: TradingProfile;
  regime: RegimeState;
  adverseExcursionPct: number;
  latencyMs: number;
}

interface SimulationStats {
  trades: ClosedTradeState[];
  cycleCount: number;
  rejectedCount: number;
  latencySum: number;
  equityCurve: number[];
  regimeStats: Map<
    RegimeState,
    {
      trades: number;
      wins: number;
      totalPnl: number;
      grossProfit: number;
      grossLoss: number;
      latencySum: number;
    }
  >;
}

const DEFAULT_DEPENDENCIES: BacktestDependencies = {
  fetchCandles: fetchHistoricalCandles,
  pipelineRunner: runAIPipeline,
};

const BACKTEST_PROFILE_ORDER: TradingProfile[] = ["scalp", "intraday", "swing"];

function toBybitInterval(timeframe: string): string {
  const map: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "4h": "240",
    "1d": "D",
  };
  return map[timeframe] ?? "1";
}

function timeframeToMinutes(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 1,
    "5m": 5,
    "15m": 15,
    "1h": 60,
    "4h": 240,
    "1d": 1440,
  };
  return map[timeframe] ?? 1;
}

function timeframeToMs(timeframe: string): number {
  return timeframeToMinutes(timeframe) * 60_000;
}

function parseDateBoundary(date: string, end = false): number {
  const [year, month, day] = date.split("-").map((part) => parseInt(part, 10));
  if (!year || !month || !day) {
    throw new Error(`Invalid date: ${date}`);
  }

  return end
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function normalizeCandles(candles: CandleBar[]): CandleBar[] {
  return [...candles]
    .filter((candle) =>
      Number.isFinite(candle.timestamp) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      Number.isFinite(candle.volume))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function dedupeCandles(candles: CandleBar[]): CandleBar[] {
  const seen = new Map<number, CandleBar>();
  for (const candle of candles) {
    seen.set(candle.timestamp, candle);
  }
  return [...seen.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function getProfileBaseTimeframe(profile: TradingProfile): string {
  return TRADING_PROFILE_DEFAULTS[profile].timeframes[0];
}

function getProfileTimeframes(profile: TradingProfile): string[] {
  return [...TRADING_PROFILE_DEFAULTS[profile].timeframes];
}

function buildProfileEngineConfig(engineConfig: EngineConfig, profile: TradingProfile): EngineConfig {
  return {
    ...engineConfig,
    tradingProfile: profile,
  };
}

function aggregateCandles(source: CandleBar[], targetTimeframe: string): CandleBar[] {
  const intervalMs = timeframeToMs(targetTimeframe);
  if (intervalMs <= 0) return [...source];
  if (source.length === 0) return [];

  const buckets = new Map<number, CandleBar[]>();
  for (const candle of source) {
    const bucketStart = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    const items = buckets.get(bucketStart);
    if (items) items.push(candle);
    else buckets.set(bucketStart, [candle]);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, items]) => {
      const sorted = items.sort((a, b) => a.timestamp - b.timestamp);
      const open = sorted[0];
      const close = sorted[sorted.length - 1];
      return {
        timestamp: close.timestamp ?? bucketStart,
        open: open.open,
        high: Math.max(...sorted.map((candle) => candle.high)),
        low: Math.min(...sorted.map((candle) => candle.low)),
        close: close.close,
        volume: sorted.reduce((sum, candle) => sum + candle.volume, 0),
      };
    });
}

function buildReplaySnapshotAtIndex(args: {
  symbol: string;
  mode: CandleMode;
  profile: TradingProfile;
  engineConfig: EngineConfig;
  candles: CandleBar[];
  index: number;
  contextStartIndex: number;
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
}): MarketSnapshot {
  const current = args.candles[args.index];
  const contextStartIndex = Math.max(0, args.contextStartIndex);
  const primaryCandles = args.candles.slice(contextStartIndex, args.index + 1);
  const timeframes = getProfileTimeframes(args.profile);
  const baseTimeframe = timeframes[0];

  return buildReplayMarketSnapshot({
    symbol: args.symbol,
    mode: args.mode,
    portfolio: args.portfolio,
    openPositions: args.openPositions,
    engineConfig: buildProfileEngineConfig(args.engineConfig, args.profile),
    primaryCandles,
    multiTimeframeCandles: timeframes.map((timeframe) => ({
      timeframe,
      candles: timeframe === baseTimeframe
        ? [...primaryCandles]
        : aggregateCandles(primaryCandles, timeframe),
    })),
    timestamp: new Date(current.timestamp).toISOString(),
  });
}

function evaluateExit(openTrade: OpenTradeState, candle: CandleBar, currentIndex: number): {
  reason: BacktestTrade["reason"] | null;
  exitPrice: number | null;
} {
  const timeExit = currentIndex - openTrade.openedIndex >= openTrade.maxHoldBars;
  const trailingStop = openTrade.trailingStopPct && openTrade.trailingStopPct > 0
    ? (openTrade.side === "BUY"
      ? Math.max(openTrade.stopLoss, openTrade.bestPrice * (1 - openTrade.trailingStopPct / 100))
      : Math.min(openTrade.stopLoss, openTrade.bestPrice * (1 + openTrade.trailingStopPct / 100)))
    : openTrade.stopLoss;

  if (openTrade.side === "BUY") {
    if (candle.low <= trailingStop) {
      return { reason: "STOP_LOSS", exitPrice: trailingStop };
    }
    if (candle.high >= openTrade.takeProfit) {
      return { reason: "TAKE_PROFIT", exitPrice: openTrade.takeProfit };
    }
  } else {
    if (candle.high >= trailingStop) {
      return { reason: "STOP_LOSS", exitPrice: trailingStop };
    }
    if (candle.low <= openTrade.takeProfit) {
      return { reason: "TAKE_PROFIT", exitPrice: openTrade.takeProfit };
    }
  }

  if (timeExit) {
    return { reason: "TIME_EXIT", exitPrice: candle.close };
  }

  return { reason: null, exitPrice: null };
}

function updateTrailingState(openTrade: OpenTradeState, candle: CandleBar): void {
  if (openTrade.side === "BUY") {
    openTrade.bestPrice = Math.max(openTrade.bestPrice, candle.high);
    openTrade.worstPrice = Math.min(openTrade.worstPrice, candle.low);
  } else {
    openTrade.bestPrice = Math.min(openTrade.bestPrice, candle.low);
    openTrade.worstPrice = Math.max(openTrade.worstPrice, candle.high);
  }
}

function computeAdverseExcursionPct(openTrade: OpenTradeState): number {
  return openTrade.side === "BUY"
    ? Math.max(0, ((openTrade.entryPrice - openTrade.worstPrice) / Math.max(openTrade.entryPrice, 1)) * 100)
    : Math.max(0, ((openTrade.worstPrice - openTrade.entryPrice) / Math.max(openTrade.entryPrice, 1)) * 100);
}

function computeTradeReturnPct(trade: ClosedTradeState): number {
  return trade.entryPrice > 0 ? (trade.pnl / Math.max(trade.entryPrice * trade.quantity, 1)) * 100 : 0;
}

function computeSharpeRatio(trades: ClosedTradeState[]): number {
  const returns = trades.map(computeTradeReturnPct);
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(Math.max(variance, 0));
  return stdDev > 0 ? (mean / stdDev) * Math.sqrt(returns.length) : 0;
}

function computeSortinoRatio(trades: ClosedTradeState[]): number {
  const returns = trades.map(computeTradeReturnPct);
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const downside = returns.filter((value) => value < 0);
  if (downside.length === 0) return mean > 0 ? mean * Math.sqrt(returns.length) : 0;

  const downsideMean = downside.reduce((sum, value) => sum + value, 0) / downside.length;
  const downsideVariance = downside.reduce((sum, value) => sum + Math.pow(value - downsideMean, 2), 0) / downside.length;
  const downsideDeviation = Math.sqrt(Math.max(downsideVariance, 0));
  return downsideDeviation > 0 ? (mean / downsideDeviation) * Math.sqrt(returns.length) : 0;
}

function computeMaxDrawdownPct(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;

  let peak = equityCurve[0];
  let maxDrawdown = 0;
  for (const equity of equityCurve) {
    peak = Math.max(peak, equity);
    if (peak <= 0) continue;
    const drawdown = ((peak - equity) / peak) * 100;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  return maxDrawdown;
}

function buildRegimeBreakdown(trades: ClosedTradeState[]): BacktestRegimeBreakdown[] {
  const stats = new Map<
    RegimeState,
    {
      trades: number;
      wins: number;
      totalPnl: number;
      grossProfit: number;
      grossLoss: number;
      latencySum: number;
    }
  >();

  for (const trade of trades) {
    const bucket = stats.get(trade.regime) ?? {
      trades: 0,
      wins: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      latencySum: 0,
    };

    bucket.trades += 1;
    bucket.totalPnl += trade.pnl;
    bucket.latencySum += trade.latencyMs;
    if (trade.pnl >= 0) {
      bucket.wins += 1;
      bucket.grossProfit += trade.pnl;
    } else {
      bucket.grossLoss += Math.abs(trade.pnl);
    }

    stats.set(trade.regime, bucket);
  }

  return [...stats.entries()]
    .map(([regime, bucket]) => ({
      regime,
      trades: bucket.trades,
      winRate: bucket.trades > 0 ? (bucket.wins / bucket.trades) * 100 : 0,
      totalPnl: bucket.totalPnl,
      profitFactor: bucket.grossLoss > 0 ? bucket.grossProfit / bucket.grossLoss : bucket.grossProfit > 0 ? bucket.grossProfit : 0,
      averageLatencyMs: bucket.trades > 0 ? bucket.latencySum / bucket.trades : 0,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl);
}

function summarizeTrades(args: {
  startingBalance: number;
  trades: ClosedTradeState[];
  cycleCount: number;
  rejectedCount: number;
  latencySum: number;
  equityCurve: number[];
}): Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward"> {
  const totalTrades = args.trades.length;
  const wins = args.trades.filter((trade) => trade.pnl >= 0).length;
  const totalPnl = args.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossProfit = args.trades.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = args.trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + Math.abs(trade.pnl), 0);
  const averageAdverseExcursion = totalTrades > 0
    ? args.trades.reduce((sum, trade) => sum + trade.adverseExcursionPct, 0) / totalTrades
    : 0;
  const aiRejectionRate = args.cycleCount > 0 ? (args.rejectedCount / args.cycleCount) * 100 : 0;
  const averageLatencyMs = args.cycleCount > 0 ? args.latencySum / args.cycleCount : 0;
  const finalBalance = args.startingBalance + totalPnl;

  return {
    startingBalance: args.startingBalance,
    finalBalance,
    totalTrades,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    totalPnl,
    maxDrawdown: computeMaxDrawdownPct(args.equityCurve),
    sharpeRatio: computeSharpeRatio(args.trades),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0,
    expectancy: totalTrades > 0 ? totalPnl / totalTrades : 0,
    sortinoRatio: computeSortinoRatio(args.trades),
    averageAdverseExcursion,
    aiRejectionRate,
    averageLatencyMs,
    regimeBreakdown: buildRegimeBreakdown(args.trades),
  };
}

function scoreResult(result: Pick<BacktestResult, "profitFactor" | "sharpeRatio" | "sortinoRatio" | "maxDrawdown" | "averageAdverseExcursion" | "aiRejectionRate" | "expectancy" | "startingBalance">): number {
  const expectancyPct = result.startingBalance > 0 ? (result.expectancy / result.startingBalance) * 100 : 0;
  return (
    result.profitFactor * 4 +
    result.sharpeRatio * 2 +
    result.sortinoRatio * 1.5 +
    expectancyPct * 8 -
    result.maxDrawdown * 0.35 -
    result.averageAdverseExcursion * 0.5 -
    result.aiRejectionRate * 0.05
  );
}

function buildDecisionStride(profile: TradingProfile, windowSize: number): number {
  const targetDecisionPoints: Record<TradingProfile, number> = {
    scalp: 180,
    intraday: 120,
    swing: 80,
    custom: 120,
  };

  return Math.max(1, Math.floor(windowSize / targetDecisionPoints[profile]));
}

async function fetchHistoricalCandles(args: {
  symbol: string;
  timeframe: string;
  mode: CandleMode;
  start: number;
  end: number;
}): Promise<CandleBar[]> {
  const category = args.mode === "spot" ? "spot" : "linear";
  const interval = toBybitInterval(args.timeframe);
  const limit = 1000;
  const all: CandleBar[] = [];
  let cursorEnd = args.end;
  let pageGuard = 0;

  while (cursorEnd >= args.start && pageGuard < 60) {
    const { data } = await axios.get("https://api.bybit.com/v5/market/kline", {
      params: {
        category,
        symbol: args.symbol,
        interval,
        start: args.start,
        end: cursorEnd,
        limit,
      },
    });

    const rows = (data as { result?: { list?: string[][] } }).result?.list ?? [];
    const page = rows
      .map((row) => ({
        timestamp: parseInt(row[0], 10),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
        volume: parseFloat(row[5]),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (page.length === 0) break;

    all.push(...page);
    const earliest = page[0].timestamp;
    if (earliest <= args.start) break;

    const nextEnd = earliest - 1;
    if (nextEnd >= cursorEnd) break;
    cursorEnd = nextEnd;
    pageGuard += 1;

    if (page.length < limit) break;
  }

  return dedupeCandles(normalizeCandles(all));
}

async function runReplayWindow(args: {
  userId: string;
  symbol: string;
  mode: CandleMode;
  profile: TradingProfile;
  engineConfig: EngineConfig;
  candles: CandleBar[];
  window: ReplayWindow;
  startingBalance: number;
  openaiApiKey?: string;
  dependencies: BacktestDependencies;
  onProgress?: (progress: { current: number; total: number; status: string }) => void;
  progressOffset: number;
  progressTotal: number;
}): Promise<{
  summary: Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward">;
  trades: ClosedTradeState[];
  cycleCount: number;
  rejectedCount: number;
  latencySum: number;
  processedCount: number;
  startTimestamp: number;
  endTimestamp: number;
}> {
  const baseTimeframe = getProfileBaseTimeframe(args.profile);
  const barIntervalMs = timeframeToMs(baseTimeframe);
  const windowSize = Math.max(1, args.window.endIndex - args.window.testStartIndex);
  const decisionStride = buildDecisionStride(args.profile, windowSize);

  const simulation: SimulationStats = {
    trades: [],
    cycleCount: 0,
    rejectedCount: 0,
    latencySum: 0,
    equityCurve: [args.startingBalance],
    regimeStats: new Map(),
  };

  let realizedBalance = args.startingBalance;
  let openTrade: OpenTradeState | null = null;

  const updateProgress = (current: number, status: string) => {
    args.onProgress?.({
      current: args.progressOffset + current,
      total: args.progressTotal,
      status,
    });
  };

  for (let index = args.window.testStartIndex; index < args.window.endIndex; index += 1) {
    const candle = args.candles[index];

    if (openTrade) {
      updateTrailingState(openTrade, candle);

      const exit = evaluateExit(openTrade, candle, index);
      if (exit.reason && exit.exitPrice !== null) {
        const pnl = openTrade.side === "BUY"
          ? (exit.exitPrice - openTrade.entryPrice) * openTrade.quantity
          : (openTrade.entryPrice - exit.exitPrice) * openTrade.quantity;
        realizedBalance += pnl;

        const closedTrade: ClosedTradeState = {
          side: openTrade.side,
          entryPrice: openTrade.entryPrice,
          exitPrice: exit.exitPrice,
          quantity: openTrade.quantity,
          pnl,
          reason: exit.reason,
          entryTime: openTrade.openedAt,
          exitTime: new Date(candle.timestamp).toISOString(),
          aiConfidence: openTrade.aiConfidence,
          profile: openTrade.profile,
          regime: openTrade.regime,
          fold: openTrade.fold,
          adverseExcursionPct: computeAdverseExcursionPct(openTrade),
          latencyMs: openTrade.latencyMs,
        };
        simulation.trades.push(closedTrade);

        const bucket = simulation.regimeStats.get(closedTrade.regime) ?? {
          trades: 0,
          wins: 0,
          totalPnl: 0,
          grossProfit: 0,
          grossLoss: 0,
          latencySum: 0,
        };
        bucket.trades += 1;
        bucket.totalPnl += pnl;
        bucket.latencySum += closedTrade.latencyMs;
        if (pnl >= 0) {
          bucket.wins += 1;
          bucket.grossProfit += pnl;
        } else {
          bucket.grossLoss += Math.abs(pnl);
        }
        simulation.regimeStats.set(closedTrade.regime, bucket);

        openTrade = null;
      }
    }

    const unrealized: number = openTrade
      ? openTrade.side === "BUY"
        ? (candle.close - openTrade.entryPrice) * openTrade.quantity
        : (openTrade.entryPrice - candle.close) * openTrade.quantity
      : 0;
    const equity: number = realizedBalance + unrealized;
    simulation.equityCurve.push(equity);

    const shouldEvaluate = index >= args.window.testStartIndex && !openTrade && ((index - args.window.testStartIndex) % decisionStride === 0);
    if (!shouldEvaluate) {
      updateProgress(index - args.window.testStartIndex + 1, `Replaying ${args.profile} window${args.window.fold ? ` #${args.window.fold}` : ""}`);
      continue;
    }

    const currentPrice = candle.close;
    const snapshotPortfolio: PortfolioSnapshot = {
      totalBalance: equity,
      availableBalance: equity,
      dailyPnl: 0,
      weeklyPnl: 0,
    };
    const snapshot = buildReplaySnapshotAtIndex({
      symbol: args.symbol,
      mode: args.mode,
      profile: args.profile,
      engineConfig: args.engineConfig,
      candles: args.candles,
      index,
      contextStartIndex: args.window.contextStartIndex,
      portfolio: snapshotPortfolio,
      openPositions: [],
    });

    if (!snapshot.integrity.isDataComplete) {
      simulation.rejectedCount += 1;
      updateProgress(index - args.window.testStartIndex + 1, `Evaluated ${args.profile} window${args.window.fold ? ` #${args.window.fold}` : ""}`);
      continue;
    }

    const cycle = await args.dependencies.pipelineRunner({
      userId: args.userId,
      snapshot,
      engineConfig: buildProfileEngineConfig(args.engineConfig, args.profile),
      openaiApiKey: args.openaiApiKey,
    });

    simulation.cycleCount += 1;
    simulation.latencySum += cycle.latencyMs.total;

    const decision = cycle.finalDecision;
    const isReady = cycle.status === "READY" && decision.decision !== "HOLD";
    const contractValid =
      decision.decision === "HOLD" ||
      !decision.entry ||
      !decision.stop_loss ||
      !decision.take_profit
        ? false
        : decision.decision === "BUY"
          ? decision.stop_loss < decision.entry && decision.take_profit > decision.entry
          : decision.stop_loss > decision.entry && decision.take_profit < decision.entry;

    const entryDeviation = snapshot.currentPrice > 0
      ? Math.abs((decision.entry - snapshot.currentPrice) / snapshot.currentPrice) * 100
      : 0;
    const leverage = Math.min(Math.max(cycle.executionReview.adjustedLeverage, 1), 20);
    const sizeUsd = cycle.executionReview.adjustedSizeUsd;
    const maxSafeNotional = Math.max(0, equity * leverage);
    const quantity = Number((sizeUsd / Math.max(decision.entry || currentPrice, 1)).toFixed(6));

    if (
      !isReady ||
      !contractValid ||
      entryDeviation > 3 ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      sizeUsd <= 0 ||
      sizeUsd > maxSafeNotional
    ) {
      simulation.rejectedCount += 1;
      updateProgress(index - args.window.testStartIndex + 1, `Evaluated ${args.profile} window${args.window.fold ? ` #${args.window.fold}` : ""}`);
      continue;
    }

    const tradeSide = decision.decision === "BUY" || decision.decision === "SELL" ? decision.decision : null;
    if (!tradeSide) {
      simulation.rejectedCount += 1;
      updateProgress(index - args.window.testStartIndex + 1, `Evaluated ${args.profile} window${args.window.fold ? ` #${args.window.fold}` : ""}`);
      continue;
    }

    const fillPrice = decision.entry;
    const maxHoldBars = Math.max(1, Math.ceil((cycle.executionReview.maxHoldMinutes * 60_000) / Math.max(barIntervalMs, 1)));

    openTrade = {
      side: tradeSide,
      entryPrice: fillPrice,
      quantity,
      openedAt: new Date(candle.timestamp).toISOString(),
      openedIndex: index,
      stopLoss: cycle.executionReview.stopLoss,
      takeProfit: cycle.executionReview.takeProfit,
      trailingStopPct: cycle.executionReview.trailingStopPct,
      maxHoldBars,
      bestPrice: fillPrice,
      worstPrice: fillPrice,
      profile: args.profile,
      regime: snapshot.regimeHint,
      aiConfidence: decision.confidence,
      entryBalance: equity,
      latencyMs: cycle.latencyMs.total,
      fold: args.window.fold,
    };

    updateProgress(index - args.window.testStartIndex + 1, `Evaluated ${args.profile} window${args.window.fold ? ` #${args.window.fold}` : ""}`);
  }

  if (openTrade) {
    const lastCandle = args.candles[Math.min(args.window.endIndex - 1, args.candles.length - 1)];
    const exitPrice = lastCandle.close;
    const pnl = openTrade.side === "BUY"
      ? (exitPrice - openTrade.entryPrice) * openTrade.quantity
      : (openTrade.entryPrice - exitPrice) * openTrade.quantity;
    realizedBalance += pnl;
    const closedTrade: ClosedTradeState = {
      side: openTrade.side,
      entryPrice: openTrade.entryPrice,
      exitPrice,
      quantity: openTrade.quantity,
      pnl,
      reason: "TIME_EXIT",
      entryTime: openTrade.openedAt,
      exitTime: new Date(lastCandle.timestamp).toISOString(),
      aiConfidence: openTrade.aiConfidence,
      profile: openTrade.profile,
      regime: openTrade.regime,
      fold: openTrade.fold,
      adverseExcursionPct: computeAdverseExcursionPct(openTrade),
      latencyMs: openTrade.latencyMs,
    };
    simulation.trades.push(closedTrade);
    const bucket = simulation.regimeStats.get(closedTrade.regime) ?? {
      trades: 0,
      wins: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      latencySum: 0,
    };
    bucket.trades += 1;
    bucket.totalPnl += pnl;
    bucket.latencySum += closedTrade.latencyMs;
    if (pnl >= 0) {
      bucket.wins += 1;
      bucket.grossProfit += pnl;
    } else {
      bucket.grossLoss += Math.abs(pnl);
    }
    simulation.regimeStats.set(closedTrade.regime, bucket);
  }

  const summary = summarizeTrades({
    startingBalance: args.startingBalance,
    trades: simulation.trades,
    cycleCount: simulation.cycleCount,
    rejectedCount: simulation.rejectedCount,
    latencySum: simulation.latencySum,
    equityCurve: simulation.equityCurve,
  });

  return {
    summary,
    trades: simulation.trades,
    cycleCount: simulation.cycleCount,
    rejectedCount: simulation.rejectedCount,
    latencySum: simulation.latencySum,
    processedCount: Math.max(0, args.window.endIndex - args.window.testStartIndex),
    startTimestamp: args.candles[args.window.testStartIndex]?.timestamp ?? args.candles[0]?.timestamp ?? Date.now(),
    endTimestamp: args.candles[Math.max(args.window.endIndex - 1, 0)]?.timestamp ?? args.candles.at(-1)?.timestamp ?? Date.now(),
  };
}

function combineSummaries(args: {
  startingBalance: number;
  runs: Array<{
    summary: Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward">;
    trades: ClosedTradeState[];
    cycleCount: number;
    rejectedCount: number;
    latencySum: number;
  }>;
}): Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward"> {
  const trades = args.runs.flatMap((run) => run.trades);
  const cycleCount = args.runs.reduce((sum, run) => sum + run.cycleCount, 0);
  const rejectedCount = args.runs.reduce((sum, run) => sum + run.rejectedCount, 0);
  const latencySum = args.runs.reduce((sum, run) => sum + run.latencySum, 0);
  const equityCurve = [args.startingBalance];
  let equity = args.startingBalance;
  for (const trade of trades) {
    equity += trade.pnl;
    equityCurve.push(equity);
  }

  return summarizeTrades({
    startingBalance: args.startingBalance,
    trades,
    cycleCount,
    rejectedCount,
    latencySum,
    equityCurve,
  });
}

function buildWalkForwardEvaluation(args: {
  startingBalance: number;
  runsByProfile: Array<{
    profile: TradingProfile;
    runs: Array<{
      profile: TradingProfile;
      fold: number;
      trainPeriod: string;
      testPeriod: string;
      summary: Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward">;
      trades: ClosedTradeState[];
      cycleCount: number;
      rejectedCount: number;
      latencySum: number;
    }>;
  }>;
}): WalkForwardEvaluation {
  const profileResults = args.runsByProfile
    .map((entry) => ({
      profile: entry.profile,
      ...combineSummaries({
        startingBalance: args.startingBalance,
        runs: entry.runs,
      }),
    }))
    .sort((a, b) => scoreResult(b) - scoreResult(a))
    .map(({ startingBalance: _startingBalance, ...rest }) => rest);

  const flatRuns = args.runsByProfile.flatMap((entry) => entry.runs);
  const bestProfile = profileResults[0]?.profile ?? "intraday";
  const bestSummary = profileResults[0];

  return {
    enabled: true,
    sweepProfiles: BACKTEST_PROFILE_ORDER,
    folds: flatRuns.map((run) => {
      const summary = run.summary;
      return {
        profile: run.profile,
        fold: run.fold,
        trainPeriod: run.trainPeriod,
        testPeriod: run.testPeriod,
        startingBalance: summary.startingBalance,
        finalBalance: summary.finalBalance,
        totalTrades: summary.totalTrades,
        winRate: summary.winRate,
        totalPnl: summary.totalPnl,
        maxDrawdown: summary.maxDrawdown,
        sharpeRatio: summary.sharpeRatio,
        profitFactor: summary.profitFactor,
        expectancy: summary.expectancy,
        sortinoRatio: summary.sortinoRatio,
        averageAdverseExcursion: summary.averageAdverseExcursion,
        aiRejectionRate: summary.aiRejectionRate,
        averageLatencyMs: summary.averageLatencyMs,
        regimeBreakdown: summary.regimeBreakdown,
      };
    }),
    profileResults,
    bestProfile,
    bestProfileReason: bestSummary
      ? `${bestProfile} ranked highest on the composite risk-adjusted score with profit factor ${bestSummary.profitFactor.toFixed(2)}, drawdown ${bestSummary.maxDrawdown.toFixed(1)}%, and expectancy $${bestSummary.expectancy.toFixed(2)}.`
      : "No walk-forward profile produced trades.",
  };
}

export async function runBacktest(
  args: BacktestRunInput & {
    userId: string;
    exchange: "bybit";
    mode: CandleMode;
    riskProfile: unknown;
    engineConfig: EngineConfig;
    openaiApiKey?: string;
  },
  onProgress?: (progress: { current: number; total: number; status: string }) => void,
  dependencies: Partial<BacktestDependencies> = {},
): Promise<BacktestResult> {
  const deps: BacktestDependencies = {
    fetchCandles: dependencies.fetchCandles ?? DEFAULT_DEPENDENCIES.fetchCandles,
    pipelineRunner: dependencies.pipelineRunner ?? DEFAULT_DEPENDENCIES.pipelineRunner,
  };

  const profile = args.engineConfig.tradingProfile;
  const baseTimeframe = getProfileBaseTimeframe(profile);
  const start = parseDateBoundary(args.startDate, false);
  const end = parseDateBoundary(args.endDate, true);

  await logger.info("SYSTEM", `Running backtest for ${args.symbol} on ${profile}${args.walkForwardSweep ? " with walk-forward sweep" : ""}`);

  const candles = normalizeCandles(await deps.fetchCandles({
    symbol: args.symbol.toUpperCase(),
    timeframe: baseTimeframe,
    mode: args.mode,
    start,
    end,
  }));

  if (candles.length < ENGINE.MIN_BARS_FOR_INDICATORS + 5) {
    throw new Error(`Not enough historical candles for ${profile} backtest`);
  }

  const warmupBars = Math.max(ENGINE.MIN_BARS_FOR_INDICATORS, 60);
  const baseWindow: ReplayWindow = {
    contextStartIndex: 0,
    testStartIndex: warmupBars,
    endIndex: candles.length,
    profile,
  };

  const baseRun = await runReplayWindow({
    userId: args.userId,
    symbol: args.symbol.toUpperCase(),
    mode: args.mode,
    profile,
    engineConfig: args.engineConfig,
    candles,
    window: baseWindow,
    startingBalance: args.startingBalance,
    openaiApiKey: args.openaiApiKey,
    dependencies: deps,
    onProgress,
    progressOffset: 0,
    progressTotal: Math.max(1, candles.length - baseWindow.testStartIndex),
  });

  let walkForward: WalkForwardEvaluation | undefined;

  if (args.walkForwardSweep) {
    const runsByProfile: Array<{
      profile: TradingProfile;
      runs: Array<{
        profile: TradingProfile;
        fold: number;
        trainPeriod: string;
        testPeriod: string;
        summary: Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward">;
        trades: ClosedTradeState[];
        cycleCount: number;
        rejectedCount: number;
        latencySum: number;
      }>;
    }> = [];

    const profileOrder = BACKTEST_PROFILE_ORDER;
    for (const sweepProfile of profileOrder) {
      let progressOffset = 0;
      const sweepBaseTimeframe = getProfileBaseTimeframe(sweepProfile);
      const sweepCandles = sweepBaseTimeframe === baseTimeframe
        ? candles
        : normalizeCandles(await deps.fetchCandles({
          symbol: args.symbol.toUpperCase(),
          timeframe: sweepBaseTimeframe,
          mode: args.mode,
          start,
          end,
        }));

      if (sweepCandles.length < ENGINE.MIN_BARS_FOR_INDICATORS + 5) {
        continue;
      }

      const warmupBars = Math.max(ENGINE.MIN_BARS_FOR_INDICATORS, 60);
      const usable = Math.max(0, sweepCandles.length - warmupBars);
      if (usable < 10) {
        continue;
      }
      const foldCount = Math.min(3, Math.max(1, Math.floor(usable / 120)));
      const segmentSize = Math.max(1, Math.min(usable, Math.floor(usable / (foldCount + 1)) || usable));
      const foldSummaries: Array<{
        profile: TradingProfile;
        fold: number;
        trainPeriod: string;
        testPeriod: string;
        summary: Omit<BacktestResult, "symbol" | "period" | "profile" | "trades" | "walkForward">;
        trades: ClosedTradeState[];
        cycleCount: number;
        rejectedCount: number;
        latencySum: number;
      }> = [];

      for (let fold = 0; fold < foldCount; fold += 1) {
        const testStart = Math.min(sweepCandles.length - 1, warmupBars + segmentSize * (fold + 1));
        const testEnd = fold === foldCount - 1
          ? sweepCandles.length
          : Math.min(sweepCandles.length, warmupBars + segmentSize * (fold + 2));
        const trainStart = Math.max(0, Math.min(testStart - 1, testStart - segmentSize * 3));
        if (testStart >= testEnd || trainStart >= testStart) {
          continue;
        }
        const window: ReplayWindow = {
          contextStartIndex: trainStart,
          testStartIndex: testStart,
          endIndex: testEnd,
          profile: sweepProfile,
          fold: fold + 1,
        };

        const trainPeriod = `${new Date(sweepCandles[trainStart]?.timestamp ?? sweepCandles[0].timestamp).toISOString()} → ${new Date(sweepCandles[Math.max(testStart - 1, trainStart)]?.timestamp ?? sweepCandles[trainStart].timestamp).toISOString()}`;
        const testPeriod = `${new Date(sweepCandles[testStart]?.timestamp ?? sweepCandles[trainStart].timestamp).toISOString()} → ${new Date(sweepCandles[Math.max(testEnd - 1, testStart)]?.timestamp ?? sweepCandles[testStart].timestamp).toISOString()}`;

        const run = await runReplayWindow({
          userId: args.userId,
          symbol: args.symbol.toUpperCase(),
          mode: args.mode,
          profile: sweepProfile,
          engineConfig: args.engineConfig,
          candles: sweepCandles,
          window,
          startingBalance: args.startingBalance,
          openaiApiKey: args.openaiApiKey,
          dependencies: deps,
          onProgress,
          progressOffset,
          progressTotal: Math.max(1, sweepCandles.length - warmupBars),
        });
        progressOffset += run.processedCount;
        foldSummaries.push({
          profile: sweepProfile,
          fold: fold + 1,
          trainPeriod,
          testPeriod,
          summary: run.summary,
          trades: run.trades,
          cycleCount: run.cycleCount,
          rejectedCount: run.rejectedCount,
          latencySum: run.latencySum,
        });
      }

      if (foldSummaries.length > 0) {
        runsByProfile.push({
          profile: sweepProfile,
          runs: foldSummaries,
        });
      }
    }

    if (runsByProfile.length > 0) {
      walkForward = buildWalkForwardEvaluation({
        startingBalance: args.startingBalance,
        runsByProfile,
      });
    }
  }

  const period = `${args.startDate} → ${args.endDate}`;
  const result: BacktestResult = {
    symbol: args.symbol.toUpperCase(),
    period,
    profile,
    ...baseRun.summary,
    trades: baseRun.trades,
    walkForward,
  };

  onProgress?.({
    current: 100,
    total: 100,
    status: walkForward ? "Backtest complete with walk-forward sweep" : "Backtest complete",
  });

  return result;
}
