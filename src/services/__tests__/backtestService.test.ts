jest.mock("../loggerService", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { runBacktest, type BacktestDependencies } from "../backtestService";
import { getDefaultEngineConfig } from "../marketSnapshotService";
import type { CandleBar, AgentCycleResult, MarketSnapshot } from "../../shared/types";

function makeTrendCandles(count: number): CandleBar[] {
  const candles: CandleBar[] = [];
  let close = 100;
  for (let i = 0; i < count; i += 1) {
    const drift = i < count / 3 ? 0.18 : i < (count * 2) / 3 ? -0.12 : 0.24;
    const open = close;
    close = Math.max(10, close + drift);
    const high = Math.max(open, close) + 0.35;
    const low = Math.min(open, close) - 0.35;
    candles.push({
      timestamp: i * 60_000,
      open,
      high,
      low,
      close,
      volume: 1_000 + i,
    });
  }
  return candles;
}

function aggregateCandles(source: CandleBar[], windowMinutes: number): CandleBar[] {
  const intervalMs = windowMinutes * 60_000;
  const buckets = new Map<number, CandleBar[]>();

  for (const candle of source) {
    const bucket = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    const items = buckets.get(bucket) ?? [];
    items.push(candle);
    buckets.set(bucket, items);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, items]) => {
      const sorted = items.sort((a, b) => a.timestamp - b.timestamp);
      return {
        timestamp,
        open: sorted[0].open,
        high: Math.max(...sorted.map((c) => c.high)),
        low: Math.min(...sorted.map((c) => c.low)),
        close: sorted[sorted.length - 1].close,
        volume: sorted.reduce((sum, c) => sum + c.volume, 0),
      };
    });
}

function makeCycle(snapshot: MarketSnapshot, side: "BUY" | "SELL"): AgentCycleResult {
  const entry = snapshot.currentPrice;
  const stopLoss = side === "BUY" ? entry * 0.992 : entry * 1.008;
  const takeProfit = side === "BUY" ? entry * 1.016 : entry * 0.984;
  const sizeUsd = snapshot.profile.profile === "swing" ? 1600 : snapshot.profile.profile === "intraday" ? 1200 : 800;

  return {
    cycleId: `${snapshot.symbol}-${snapshot.timestamp}`,
    timestamp: snapshot.timestamp,
    symbol: snapshot.symbol,
    profile: snapshot.profile.profile,
    snapshot,
    retrievedMemories: [],
    memorySummary: "stub",
    marketAssessment: {
      regime: snapshot.regimeHint,
      volatilityBucket: snapshot.tempoState.volatilityBucket,
      tempoFit: snapshot.tempoState.tempoFit,
      directionalBias: side === "BUY" ? "LONG" : "SHORT",
      conviction: 0.84,
      noTrade: false,
      noTradeReasons: [],
      keyDrivers: ["stub"],
      riskFlags: [],
      summary: "stub",
    },
    tradeProposal: {
      action: side,
      confidence: 0.84,
      entryZone: { min: entry * 0.999, max: entry * 1.001, preferred: entry },
      leverage: 2,
      sizeUsd,
      stopLoss,
      takeProfit,
      trailingStopPct: null,
      maxHoldMinutes: snapshot.profile.maxHoldMinutes,
      exitStyle: "fixed",
      thesis: "stub",
      invalidation: "stub",
    },
    executionReview: {
      verdict: "APPROVE",
      finalAction: side,
      finalConfidence: 0.84,
      adjustedLeverage: 2,
      adjustedSizeUsd: sizeUsd,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      trailingStopPct: null,
      maxHoldMinutes: snapshot.profile.maxHoldMinutes,
      reasons: ["stub"],
      exchangeWarnings: [],
    },
    finalDecision: {
      decision: side,
      confidence: 0.84,
      entry,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      reason: "stub",
    },
    latencyMs: {
      total: 15,
      marketAnalyst: 5,
      tradeArchitect: 5,
      executionCritic: 5,
    },
    status: "READY",
  };
}

function buildDependencies(baseCandles: CandleBar[]): BacktestDependencies {
  const byTimeframe = new Map<string, CandleBar[]>([
    ["1m", baseCandles],
    ["5m", aggregateCandles(baseCandles, 5)],
    ["15m", aggregateCandles(baseCandles, 15)],
  ]);

  return {
    fetchCandles: async ({ timeframe }) => byTimeframe.get(timeframe) ?? baseCandles,
    pipelineRunner: async ({ snapshot }) => {
      const prevClose = snapshot.recentCandles.at(-2)?.close ?? snapshot.currentPrice;
      const delta = snapshot.currentPrice - prevClose;
      if (snapshot.regimeHint === "ranging" || Math.abs(delta) < 0.03) {
        return {
          ...makeCycle(snapshot, "BUY"),
          status: "HOLD",
          finalDecision: {
            decision: "HOLD",
            confidence: 0.2,
            entry: 0,
            stop_loss: 0,
            take_profit: 0,
            reason: "range",
          },
          executionReview: {
            verdict: "HOLD",
            finalAction: "HOLD",
            finalConfidence: 0.2,
            adjustedLeverage: 1,
            adjustedSizeUsd: 0,
            entryPrice: snapshot.currentPrice,
            stopLoss: snapshot.currentPrice,
            takeProfit: snapshot.currentPrice,
            trailingStopPct: null,
            maxHoldMinutes: snapshot.profile.maxHoldMinutes,
            reasons: ["range"],
            exchangeWarnings: [],
          },
        };
      }

      const side = delta >= 0 ? "BUY" : "SELL";
      return makeCycle(snapshot, side);
    },
  };
}

describe("backtestService", () => {
  it("runs a standard backtest and returns quality metrics", async () => {
    const candles = makeTrendCandles(1200);
    const snapshots: MarketSnapshot[] = [];
    const deps = buildDependencies(candles);
    const engineConfig = getDefaultEngineConfig();
    engineConfig.tradingProfile = "intraday";

    const result = await runBacktest(
      {
        userId: "user-1",
        symbol: "BTCUSDT",
        exchange: "bybit",
        mode: "futures",
        startDate: "2025-01-01",
        endDate: "2025-01-10",
        startingBalance: 10_000,
        walkForwardSweep: false,
        riskProfile: { maxRiskPct: 2, maxDailyLossPct: 5, maxOpenPositions: 3, minConfidence: 0.75, maxLeverage: 10 },
        engineConfig,
        openaiApiKey: "test-key",
      },
      undefined,
      {
        ...deps,
        pipelineRunner: async (args) => {
          snapshots.push(args.snapshot);
          return deps.pipelineRunner(args);
        },
      },
    );

    expect(result.profile).toBe("intraday");
    expect(result.totalTrades).toBeGreaterThan(0);
    expect(result.regimeBreakdown.length).toBeGreaterThan(0);
    expect(result.averageLatencyMs).toBeGreaterThan(0);
    expect(result.profitFactor).toBeGreaterThan(0);
    expect(result.walkForward).toBeUndefined();
    expect(snapshots[0].multiTimeframeCandles[0].candles.length).toBe(61);
  });

  it("runs a walk-forward sweep and ranks tempo profiles", async () => {
    const candles = makeTrendCandles(1200);
    const deps = buildDependencies(candles);
    const engineConfig = getDefaultEngineConfig();
    engineConfig.tradingProfile = "intraday";

    const result = await runBacktest(
      {
        userId: "user-1",
        symbol: "BTCUSDT",
        exchange: "bybit",
        mode: "futures",
        startDate: "2025-01-01",
        endDate: "2025-01-10",
        startingBalance: 10_000,
        walkForwardSweep: true,
        riskProfile: { maxRiskPct: 2, maxDailyLossPct: 5, maxOpenPositions: 3, minConfidence: 0.75, maxLeverage: 10 },
        engineConfig,
        openaiApiKey: "test-key",
      },
      undefined,
      deps,
    );

    expect(result.walkForward).toBeDefined();
    expect(result.walkForward?.profileResults).toHaveLength(3);
    expect(result.walkForward?.folds.length).toBeGreaterThan(0);
    expect(result.walkForward?.bestProfile).toBeDefined();
  });
});
