import { ENGINE } from "../shared/constants.js";
import type { RiskResult, RiskContext } from "../shared/types.js";

interface RuleCheck {
  name: string;
  check: (ctx: RiskContext) => { pass: boolean; reason: string };
}

const rules: RuleCheck[] = [
  {
    name: "MAX_RISK_PER_TRADE",
    check: (ctx) => {
      const riskAmount = ctx.portfolio.totalBalance * (ctx.riskProfile.maxRiskPct / 100);
      const tradeRisk = Math.abs(ctx.decision.entry - ctx.decision.stop_loss);
      if (tradeRisk <= 0) return { pass: false, reason: "Stop loss distance is zero or negative" };
      const maxQuantity = riskAmount / tradeRisk;
      return {
        pass: true,
        reason: `Max position size: ${maxQuantity.toFixed(6)} units (risk $${riskAmount.toFixed(2)})`,
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
    check: (ctx) => {
      const pass = Math.abs(ctx.priceChange1h) < ENGINE.VOLATILITY_THRESHOLD_PCT;
      return {
        pass,
        reason: pass
          ? `1h price change ${ctx.priceChange1h.toFixed(2)}% within threshold`
          : `1h price change ${ctx.priceChange1h.toFixed(2)}% exceeds ${ENGINE.VOLATILITY_THRESHOLD_PCT}% threshold`,
      };
    },
  },
  {
    name: "SPREAD_FILTER",
    check: (ctx) => {
      const pass = ctx.spread < ENGINE.SPREAD_THRESHOLD_PCT;
      return {
        pass,
        reason: pass
          ? `Spread ${ctx.spread.toFixed(3)}% within threshold`
          : `Spread ${ctx.spread.toFixed(3)}% exceeds ${ENGINE.SPREAD_THRESHOLD_PCT}% threshold`,
      };
    },
  },
  {
    name: "MAX_LEVERAGE",
    check: (ctx) => {
      if (ctx.tradingMode !== "futures") return { pass: true, reason: "Spot mode — leverage check skipped" };
      const pass = ctx.riskProfile.maxLeverage <= 125;
      return {
        pass,
        reason: pass
          ? `Leverage ${ctx.riskProfile.maxLeverage}x within limit`
          : `Leverage ${ctx.riskProfile.maxLeverage}x exceeds maximum`,
      };
    },
  },
  {
    name: "MAX_DRAWDOWN",
    check: (ctx) => {
      if (ctx.peakBalance <= 0) return { pass: true, reason: "No peak balance recorded yet" };
      const drawdownPct = ((ctx.peakBalance - ctx.portfolio.totalBalance) / ctx.peakBalance) * 100;
      const pass = drawdownPct < ENGINE.MAX_DRAWDOWN_PCT;
      return {
        pass,
        reason: pass
          ? `Drawdown ${drawdownPct.toFixed(1)}% < ${ENGINE.MAX_DRAWDOWN_PCT}% limit`
          : `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${ENGINE.MAX_DRAWDOWN_PCT}% limit`,
      };
    },
  },
];

export function validateTrade(ctx: RiskContext): RiskResult {
  const passed: string[] = [];
  const failed: string[] = [];
  const reasons: string[] = [];

  for (const rule of rules) {
    const result = rule.check(ctx);
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
