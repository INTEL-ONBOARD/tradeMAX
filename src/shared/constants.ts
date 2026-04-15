export const APP_NAME = "TradeMAX";
export const DEFAULT_RISK_PROFILE = {
    maxRiskPerTradePct: 0.02,
    maxDailyLossPct: 0.05,
    maxOpenPositions: 5,
    minConfidence: 0.75,
    maxSpreadPct: 0.004,
    maxVolatilityPct: 0.03,
    maxLeverage: 5,
    maxDrawdownPct: 0.15
};

export const AI_DECISION_SCHEMA_EXAMPLE = {
    decision: "HOLD",
    confidence: 0.8,
    entry: 0,
    stop_loss: 0,
    take_profit: 0,
    reason: "No clear setup"
};

export const EVENT_CHANNELS = {
    market: "stream:market",
    logs: "stream:logs",
    ai: "stream:ai"
} as const;
