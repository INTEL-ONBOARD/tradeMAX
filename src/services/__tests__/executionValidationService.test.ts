import { buildExecutionValidation } from "../executionValidationService";
import { ENGINE_DEFAULTS, RISK_DEFAULTS } from "../../shared/constants";
import type {
  AIDecision,
  EngineConfig,
  ExchangeSymbolMetadata,
  MarketSnapshot,
  RiskProfile,
  SymbolSelectionEntry,
} from "../../shared/types";

const baseDecision: AIDecision = {
  decision: "BUY",
  confidence: 0.82,
  entry: 50000,
  stop_loss: 49000,
  take_profit: 52000,
  reason: "Momentum continuation",
};

const baseRiskProfile: RiskProfile = {
  ...RISK_DEFAULTS,
};

const baseEngineConfig: EngineConfig = {
  ...ENGINE_DEFAULTS,
  candidateSymbols: [...ENGINE_DEFAULTS.candidateSymbols],
  watchlist: [...ENGINE_DEFAULTS.watchlist],
  votingModels: [...ENGINE_DEFAULTS.votingModels],
  stageModels: { ...ENGINE_DEFAULTS.stageModels },
};

const baseMetadata: ExchangeSymbolMetadata = {
  symbol: "BTCUSDT",
  mode: "futures",
  qtyStep: 0.001,
  minOrderQty: 0.001,
  minNotionalUsd: 5,
  priceTick: 0.1,
  supportsShorts: true,
};

const baseSelection: SymbolSelectionEntry = {
  symbol: "BTCUSDT",
  mode: "futures",
  marketScore: 0.8,
  performanceScore: 0.7,
  compositeScore: 0.75,
  winRate: 0.62,
  sampleSize: 12,
  eligible: true,
  reason: "Strong market score and acceptable recent win rate",
};

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    symbol: "BTCUSDT",
    exchange: "bybit",
    mode: "futures",
    profile: {
      profile: "intraday",
      loopIntervalSec: 12,
      primaryTimeframes: ["5m", "15m", "1h"],
      memoryHorizonHours: 96,
      maxHoldMinutes: 480,
      critiqueStrictness: "balanced",
    },
    timestamp: "2026-04-21T00:00:00.000Z",
    currentPrice: 50000,
    regimeHint: "trending_up",
    portfolio: {
      totalBalance: 10000,
      availableBalance: 10000,
      dailyPnl: 0,
      weeklyPnl: 0,
    },
    openPositions: [],
    recentCandles: [],
    multiTimeframeCandles: [],
    indicators: {
      rsi: 56,
      macd: { line: 1.2, signal: 0.9, histogram: 0.3 },
      ema: { ema12: 49920, ema26: 49780 },
      bollingerBands: { upper: 50750, middle: 50010, lower: 49280 },
      adx: 24,
      atr: 320,
      stochastic: { k: 61, d: 58 },
    },
    orderBook: {
      spreadPct: 0.05,
      bestBid: 49995,
      bestAsk: 50005,
      bidDepthTop5: 120000,
      askDepthTop5: 115000,
      imbalance: 0.04,
      bids: [],
      asks: [],
    },
    futuresContext: {
      fundingRate: 0.0001,
      nextFundingTime: "2026-04-21T08:00:00.000Z",
      openInterest: 120000000,
      openInterestChangePct: 2.1,
      basisPct: 0.03,
      markPrice: 50000,
      indexPrice: 49990,
      liquidationDistancePctLong: 8,
      liquidationDistancePctShort: 8,
      longShortPressure: "balanced",
    },
    realizedVolatilityPct: 1.4,
    priceChange1hPct: 1.1,
    tempoState: {
      volatilityBucket: "normal",
      tempoFit: "aligned",
    },
    integrity: {
      isDataComplete: true,
      warnings: [],
    },
    ...overrides,
  };
}

describe("executionValidationService", () => {
  it("approves a valid futures trade and caps trailing stop to the configured limit", () => {
    const result = buildExecutionValidation({
      decision: baseDecision,
      snapshot: makeSnapshot(),
      riskProfile: baseRiskProfile,
      engineConfig: {
        ...baseEngineConfig,
        enableTrailingStop: true,
        trailingStopPct: 1.25,
      },
      desiredSizeUsd: 1000,
      requestedLeverage: 25,
      desiredTrailingStopPct: 2.5,
      metadata: baseMetadata,
      openTradeCount: 0,
      openTradesForSymbol: 0,
      dailyRealizedLoss: 0,
      peakBalance: 10000,
      selection: baseSelection,
    });

    expect(result.approved).toBe(true);
    expect(result.leverage).toBe(baseRiskProfile.maxLeverage);
    expect(result.appliedTrailingStopPct).toBe(1.25);
    expect(result.quantity).toBeGreaterThan(0);
    expect(result.riskCheck.failed).toHaveLength(0);
  });

  it("rejects opening SELL exposure in spot mode", () => {
    const result = buildExecutionValidation({
      decision: { ...baseDecision, decision: "SELL" },
      snapshot: makeSnapshot({ mode: "spot" }),
      riskProfile: baseRiskProfile,
      engineConfig: baseEngineConfig,
      desiredSizeUsd: 1000,
      requestedLeverage: 1,
      desiredTrailingStopPct: null,
      metadata: {
        ...baseMetadata,
        mode: "spot",
        supportsShorts: false,
      },
      openTradeCount: 0,
      openTradesForSymbol: 0,
      dailyRealizedLoss: 0,
      peakBalance: 10000,
      selection: {
        ...baseSelection,
        mode: "spot",
      },
    });

    expect(result.approved).toBe(false);
    expect(result.riskCheck.failed).toContain("SPOT_LONG_ONLY");
    expect(result.riskCheck.failed).toContain("VENUE_SHORT_CAPABILITY");
    expect(result.blockedReason).toBe("SPOT_LONG_ONLY");
  });

  it("rejects new trades when the portfolio concurrent-symbol cap is reached", () => {
    const result = buildExecutionValidation({
      decision: baseDecision,
      snapshot: makeSnapshot(),
      riskProfile: baseRiskProfile,
      engineConfig: {
        ...baseEngineConfig,
        maxConcurrentSymbols: 2,
      },
      desiredSizeUsd: 1000,
      requestedLeverage: 5,
      desiredTrailingStopPct: null,
      metadata: baseMetadata,
      openTradeCount: 2,
      openTradesForSymbol: 0,
      dailyRealizedLoss: 0,
      peakBalance: 10000,
      selection: baseSelection,
    });

    expect(result.approved).toBe(false);
    expect(result.riskCheck.failed).toContain("MAX_CONCURRENT_SYMBOLS");
    expect(result.blockedReason).toBe("MAX_CONCURRENT_SYMBOLS");
  });

  it("rejects symbols that fail the portfolio selection gate", () => {
    const result = buildExecutionValidation({
      decision: baseDecision,
      snapshot: makeSnapshot(),
      riskProfile: baseRiskProfile,
      engineConfig: baseEngineConfig,
      desiredSizeUsd: 1000,
      requestedLeverage: 5,
      desiredTrailingStopPct: null,
      metadata: baseMetadata,
      openTradeCount: 0,
      openTradesForSymbol: 0,
      dailyRealizedLoss: 0,
      peakBalance: 10000,
      selection: {
        ...baseSelection,
        eligible: false,
        reason: "Recent realized win rate is below the configured minimum",
      },
    });

    expect(result.approved).toBe(false);
    expect(result.riskCheck.failed).toContain("SYMBOL_SELECTION_GATE");
    expect(result.riskCheck.reasons).toContain("Recent realized win rate is below the configured minimum");
  });
});
