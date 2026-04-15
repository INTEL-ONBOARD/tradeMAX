import { type PortfolioSnapshot, type Position, type RiskCheckResult, type RiskProfile, type TradeCandidate } from "../shared/types.js";

export class RiskEngine {
    validateTrade(input: {
        trade: TradeCandidate;
        profile: RiskProfile;
        portfolio: PortfolioSnapshot;
        positions: Position[];
        dailyRealizedLossPct: number;
        drawdownPct: number;
    }): RiskCheckResult {
        const { trade, profile, portfolio, positions, dailyRealizedLossPct, drawdownPct } = input;
        const reasons: string[] = [];

        const distanceToStop = Math.abs(trade.entry - trade.stopLoss);
        const riskAmount = distanceToStop * trade.quantity;
        const riskPct = portfolio.totalBalance > 0 ? riskAmount / portfolio.totalBalance : 1;

        if (riskPct > profile.maxRiskPerTradePct) {
            reasons.push("Risk per trade exceeds profile limit");
        }
        if (dailyRealizedLossPct > profile.maxDailyLossPct) {
            reasons.push("Daily loss limit reached");
        }
        if (positions.length >= profile.maxOpenPositions) {
            reasons.push("Maximum open positions reached");
        }
        if (trade.confidence < profile.minConfidence) {
            reasons.push("Confidence below threshold");
        }
        if (trade.volatilityPct > profile.maxVolatilityPct) {
            reasons.push("Volatility above threshold");
        }
        if (trade.spreadPct > profile.maxSpreadPct) {
            reasons.push("Spread too wide");
        }
        if (trade.mode === "futures" && (trade.leverage || 1) > profile.maxLeverage) {
            reasons.push("Leverage exceeds profile limit");
        }
        if (drawdownPct > profile.maxDrawdownPct) {
            reasons.push("Max drawdown protection triggered");
        }

        return { approved: reasons.length === 0, reasons };
    }
}
