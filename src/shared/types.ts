// ─── User & Auth ───────────────────────────────────────
export interface UserSession {
  userId: string;
  name: string;
  email: string;
}

export interface UserSettings {
  selectedExchange: "binance" | "bybit";
  tradingMode: "spot" | "futures";
  riskProfile: RiskProfile;
  agentModeEnabled: boolean;
  themePreference: "dark" | "light";
}

export interface RiskProfile {
  maxRiskPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  minConfidence: number;
  maxLeverage: number;
}

// ─── Portfolio ─────────────────────────────────────────
export interface PortfolioSnapshot {
  totalBalance: number;
  availableBalance: number;
  dailyPnl: number;
  weeklyPnl: number;
}

// ─── Positions & Trades ───────────────────────────────
export interface Position {
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  markPrice: number;
  quantity: number;
  unrealizedPnl: number;
  liquidationPrice: number | null;
}

export interface Trade {
  _id: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnl: number | null;
  status: "OPEN" | "CLOSED";
  source: "AI" | "MANUAL" | "SYSTEM";
  exchange: "binance" | "bybit";
  mode: "spot" | "futures";
  aiDecision: AIDecision | null;
  riskCheck: RiskResult | null;
  createdAt: string;
  closedAt: string | null;
}

// ─── AI ────────────────────────────────────────────────
export interface AIDecision {
  decision: "BUY" | "SELL" | "HOLD";
  confidence: number;
  entry: number;
  stop_loss: number;
  take_profit: number;
  reason: string;
}

export interface AIPromptData {
  symbol: string;
  exchange: "binance" | "bybit";
  mode: "spot" | "futures";
  currentPrice: number;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
  };
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
  riskProfile: RiskProfile;
}

// ─── Risk ──────────────────────────────────────────────
export interface RiskResult {
  approved: boolean;
  passed: string[];
  failed: string[];
  reasons: string[];
}

export interface RiskContext {
  decision: AIDecision;
  portfolio: PortfolioSnapshot;
  openTradeCount: number;
  dailyRealizedLoss: number;
  priceChange1h: number;
  spread: number;
  peakBalance: number;
  riskProfile: RiskProfile;
  tradingMode: "spot" | "futures";
}

// ─── Safety ────────────────────────────────────────────
export interface SafetyState {
  frozen: boolean;
  frozenReason: "KILL_SWITCH" | "CONSECUTIVE_LOSSES" | "DRAWDOWN" | "API_FAILURE" | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}

// ─── Agent ─────────────────────────────────────────────
export interface AgentStatus {
  running: boolean;
  frozen: boolean;
  reason?: string;
}

// ─── Market ────────────────────────────────────────────
export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface PriceBar {
  price: number;
  timestamp: number;
}

// ─── Exchange ──────────────────────────────────────────
export interface OrderResult {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  status: string;
}

export interface ExchangeKeys {
  apiKey: string;
  apiSecret: string;
}

// ─── Logs ──────────────────────────────────────────────
export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogCategory = "AUTH" | "TRADE" | "AI" | "RISK" | "SAFETY" | "SYSTEM";

export interface LogEntry {
  _id?: string;
  userId: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}
