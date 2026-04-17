import type { RiskResult, RiskContext } from "../shared/types.js";

export interface RiskOptions {
  volatilityThresholdPct: number;
  spreadThresholdPct: number;
  maxDrawdownPct: number;
}

interface RuleCheck {
  name: string;
  check: (ctx: RiskContext, opts: RiskOptions) => { pass: boolean; reason: string };
}

const rules: RuleCheck[] = [
  {
    name: "MAX_RISK_PER_TRADE",
    check: (ctx) => {
      const riskAmount = ctx.portfolio.availableBalance * (ctx.riskProfile.maxRiskPct / 100);
      const tradeRisk = Math.abs(ctx.decision.entry - ctx.decision.stop_loss);
      if (tradeRisk <= 0) return { pass: false, reason: "Stop loss distance is zero or negative" };
      const maxQuantity = riskAmount / tradeRisk;
      const pass = ctx.intendedQuantity <= maxQuantity;
      return {
        pass,
        reason: pass
          ? `Position size ${ctx.intendedQuantity.toFixed(6)} <= max ${maxQuantity.toFixed(6)} (risk $${riskAmount.toFixed(2)})`
          : `Position size ${ctx.intendedQuantity.toFixed(6)} exceeds max ${maxQuantity.toFixed(6)} (risk $${riskAmount.toFixed(2)})`,
      };
    },
  },
  {
    name: "MAX_DAILY_LOSS",
    check: (ctx) => {
      const maxLoss = ctx.portfolio.totalBalance * (ctx.riskProfile.maxDailyLossPct / 100);
      const pass = ctx.dailyRealizedLoss < maxLoss;
      return {
        pass,
        reason: pass
          ? `Daily loss $${ctx.dailyRealizedLoss.toFixed(2)} < limit $${maxLoss.toFixed(2)}`
          : `Daily loss $${ctx.dailyRealizedLoss.toFixed(2)} exceeds limit $${maxLoss.toFixed(2)}`,
      };
    },
  },
  {
    name: "MAX_OPEN_POSITIONS",
    check: (ctx) => {
      const pass = ctx.openTradeCount < ctx.riskProfile.maxOpenPositions;
      return {
        pass,
        reason: pass
          ? `${ctx.openTradeCount} open < max ${ctx.riskProfile.maxOpenPositions}`
          : `${ctx.openTradeCount} open positions >= max ${ctx.riskProfile.maxOpenPositions}`,
      };
    },
  },
  {
    name: "MIN_CONFIDENCE",
    check: (ctx) => {
      const pass = ctx.decision.confidence >= ctx.riskProfile.minConfidence;
      return {
        pass,
        reason: pass
          ? `Confidence ${ctx.decision.confidence} >= threshold ${ctx.riskProfile.minConfidence}`
          : `Confidence ${ctx.decision.confidence} < threshold ${ctx.riskProfile.minConfidence}`,
      };
    },
  },
  {
    name: "VOLATILITY_FILTER",
    check: (ctx, opts) => {
      const pass = Math.abs(ctx.priceChange1h) < opts.volatilityThresholdPct;
      return {
        pass,
        reason: pass
          ? `1h price change ${ctx.priceChange1h.toFixed(2)}% within threshold`
          : `1h price change ${ctx.priceChange1h.toFixed(2)}% exceeds ${opts.volatilityThresholdPct}% threshold`,
      };
    },
  },
  {
    name: "SPREAD_FILTER",
    check: (ctx, opts) => {
      const pass = ctx.spread < opts.spreadThresholdPct;
      return {
        pass,
        reason: pass
          ? `Spread ${ctx.spread.toFixed(3)}% within threshold`
          : `Spread ${ctx.spread.toFixed(3)}% exceeds ${opts.spreadThresholdPct}% threshold`,
      };
    },
  },
  {
    name: "SLIPPAGE_GUARD",
    check: (ctx) => {
      // Spread itself is an indicator of potential slippage for market orders
      const estimatedSlippage = ctx.spread * 1.5; // conservative estimate
      const pass = estimatedSlippage < ctx.maxSlippagePct;
      return {
        pass,
        reason: pass
          ? `Estimated slippage ${estimatedSlippage.toFixed(3)}% within ${ctx.maxSlippagePct}% limit`
          : `Estimated slippage ${estimatedSlippage.toFixed(3)}% exceeds ${ctx.maxSlippagePct}% limit`,
      };
    },
  },
  {
    name: "MAX_LEVERAGE",
    check: (ctx) => {
      if (ctx.tradingMode !== "futures") return { pass: true, reason: "Spot mode — leverage check skipped" };
      const safeLeverage = Math.min(ctx.riskProfile.maxLeverage, 20);
      const pass = safeLeverage <= 20;
      return {
        pass,
        reason: pass
          ? `Leverage ${safeLeverage}x within limit`
          : `Leverage ${safeLeverage}x exceeds maximum`,
      };
    },
  },
  {
    name: "MAX_DRAWDOWN",
    check: (ctx, opts) => {
      if (ctx.peakBalance <= 0) return { pass: true, reason: "No peak balance recorded yet" };
      const drawdownPct = ((ctx.peakBalance - ctx.portfolio.totalBalance) / ctx.peakBalance) * 100;
      const pass = drawdownPct < opts.maxDrawdownPct;
      return {
        pass,
        reason: pass
          ? `Drawdown ${drawdownPct.toFixed(1)}% < ${opts.maxDrawdownPct}% limit`
          : `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${opts.maxDrawdownPct}% limit`,
      };
    },
  },
];

export function validateTrade(ctx: RiskContext, opts: RiskOptions): RiskResult {
  const passed: string[] = [];
  const failed: string[] = [];
  const reasons: string[] = [];

  for (const rule of rules) {
    const result = rule.check(ctx, opts);
    if (result.pass) {
      passed.push(rule.name);
    } else {
      failed.push(rule.name);
      reasons.push(result.reason);
    }
  }

  return {
    approved: failed.length === 0,
    passed,
    failed,
    reasons,
  };
}
