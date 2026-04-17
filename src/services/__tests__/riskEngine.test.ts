import { validateTrade, type RiskOptions } from "../riskEngine";
import type { RiskContext, AIDecision, PortfolioSnapshot, RiskProfile } from "../../shared/types";

const baseDecision: AIDecision = {
  decision: "BUY",
  confidence: 0.8,
  entry: 50000,
  stop_loss: 49000,
  take_profit: 52000,
  reason: "test",
};

const basePortfolio: PortfolioSnapshot = {
  totalBalance: 10000,
  availableBalance: 10000,
  dailyPnl: 0,
  weeklyPnl: 0,
};

const baseRiskProfile: RiskProfile = {
  maxRiskPct: 2,
  maxDailyLossPct: 5,
  maxOpenPositions: 3,
  minConfidence: 0.75,
  maxLeverage: 10,
};

const baseOpts: RiskOptions = {
  volatilityThresholdPct: 5,
  spreadThresholdPct: 0.5,
  maxDrawdownPct: 15,
};

function makeCtx(overrides: Partial<RiskContext> = {}): RiskContext {
  return {
    decision: baseDecision,
    portfolio: basePortfolio,
    openTradeCount: 0,
    dailyRealizedLoss: 0,
    priceChange1h: 0,
    spread: 0.05,
    peakBalance: 10000,
    riskProfile: baseRiskProfile,
    tradingMode: "spot",
    intendedQuantity: 0.2,
    maxSlippagePct: 0.5,
    ...overrides,
  };
}

describe("riskEngine", () => {
  describe("validateTrade", () => {
    it("approves a valid trade", () => {
      const result = validateTrade(makeCtx(), baseOpts);
      expect(result.approved).toBe(true);
      expect(result.failed).toHaveLength(0);
    });

    it("rejects when position size exceeds max risk", () => {
      const result = validateTrade(makeCtx({ intendedQuantity: 999 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MAX_RISK_PER_TRADE");
    });

    it("rejects when daily loss exceeds limit", () => {
      const result = validateTrade(makeCtx({ dailyRealizedLoss: 600 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MAX_DAILY_LOSS");
    });

    it("rejects when too many open positions", () => {
      const result = validateTrade(makeCtx({ openTradeCount: 5 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MAX_OPEN_POSITIONS");
    });

    it("rejects when confidence too low", () => {
      const result = validateTrade(makeCtx({
        decision: { ...baseDecision, confidence: 0.3 },
      }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MIN_CONFIDENCE");
    });

    it("rejects when volatility too high", () => {
      const result = validateTrade(makeCtx({ priceChange1h: 8 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("VOLATILITY_FILTER");
    });

    it("rejects when spread too wide", () => {
      const result = validateTrade(makeCtx({ spread: 1.0 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("SPREAD_FILTER");
    });

    it("rejects when estimated slippage exceeds threshold", () => {
      const result = validateTrade(makeCtx({ spread: 0.5, maxSlippagePct: 0.1 }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("SLIPPAGE_GUARD");
    });

    it("rejects when drawdown exceeds limit", () => {
      const result = validateTrade(makeCtx({
        peakBalance: 12000,
        portfolio: { ...basePortfolio, totalBalance: 9000 },
      }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MAX_DRAWDOWN");
    });

    it("rejects when stop loss distance is zero", () => {
      const result = validateTrade(makeCtx({
        decision: { ...baseDecision, stop_loss: 50000 },
      }), baseOpts);
      expect(result.approved).toBe(false);
    });

    it("skips leverage check in spot mode", () => {
      const result = validateTrade(makeCtx({ tradingMode: "spot" }), baseOpts);
      expect(result.passed).toContain("MAX_LEVERAGE");
    });

    it("checks leverage in futures mode", () => {
      const result = validateTrade(makeCtx({
        tradingMode: "futures",
        riskProfile: { ...baseRiskProfile, maxLeverage: 200 },
      }), baseOpts);
      expect(result.approved).toBe(false);
      expect(result.failed).toContain("MAX_LEVERAGE");
    });
  });
});
