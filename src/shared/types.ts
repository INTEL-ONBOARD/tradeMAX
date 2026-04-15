export type TradeMode = "spot" | "futures";
export type ThemePreference = "dark" | "light";
export type TradeDecision = "BUY" | "SELL" | "HOLD";
export type Exchange = "binance" | "bybit";

export interface RiskProfile {
    maxRiskPerTradePct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    minConfidence: number;
    maxSpreadPct: number;
    maxVolatilityPct: number;
    maxLeverage: number;
    maxDrawdownPct: number;
}

export interface UserSession {
    userId: string;
    email: string;
    name: string;
    agentModeEnabled: boolean;
    tradingMode: TradeMode;
    themePreference: ThemePreference;
    riskProfile: RiskProfile;
}

export interface AIDecision {
    decision: TradeDecision;
    confidence: number;
    entry: number;
    stop_loss: number;
    take_profit: number;
    reason: string;
}

export interface Position {
    exchange: Exchange;
    symbol: string;
    side: "LONG" | "SHORT";
    quantity: number;
    entryPrice: number;
    markPrice: number;
    liquidationPrice?: number;
    unrealizedPnl: number;
}

export interface PortfolioSnapshot {
    totalBalance: number;
    dailyPnl: number;
    weeklyPnl: number;
    allocation: Array<{ asset: string; value: number; percent: number }>;
}

export interface TradeCandidate {
    exchange: Exchange;
    symbol: string;
    mode: TradeMode;
    side: "BUY" | "SELL";
    quantity: number;
    entry: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    spreadPct: number;
    volatilityPct: number;
    leverage?: number;
    source: "Claude" | "manual" | "system";
}

export interface RiskCheckResult {
    approved: boolean;
    reasons: string[];
}
