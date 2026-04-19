// ─── User & Auth ───────────────────────────────────────
export interface UserSession {
  userId: string;
  name: string;
  email: string;
}

export interface UserSettings {
  selectedExchange: "bybit" | "paper";
  tradingMode: "spot" | "futures";
  riskProfile: RiskProfile;
  engineConfig: EngineConfig;
  agentModeEnabled: boolean;
  themePreference: "dark" | "light";
  hasOpenAIKey: boolean;
  hasBybitKeys: boolean;
}

export interface RiskProfile {
  maxRiskPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  minConfidence: number;
  maxLeverage: number;
}

export interface EngineConfig {
  tradingSymbol: string;
  autoPairSelection: boolean;
  loopIntervalSec: number;
  candleTimeframe: "1m" | "5m" | "15m";
  maxSlippagePct: number;
  tradeCooldownSec: number;
  aiRetryCount: number;
  aiModel: string;
  maxConsecutiveLosses: number;
  maxDrawdownPct: number;
  volatilityThresholdPct: number;
  spreadThresholdPct: number;
  wsReconnectRetries: number;
  enableEMA: boolean;
  enableBollingerBands: boolean;
  enableADX: boolean;
  enableATR: boolean;
  enableStochastic: boolean;
  enableTrailingStop: boolean;
  trailingStopPct: number;
  paperStartingBalance: number;
  watchlist: string[];
  enableMultiModelVoting: boolean;
  votingModels: string[];
}

// ─── Portfolio ─────────────────────────────────────────
export interface PortfolioSnapshot {
  totalBalance: number;
  availableBalance: number;
  dailyPnl: number;
  weeklyPnl: number;
}

// ─── Candles ──────────────────────────────────────────
export interface CandleBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
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
  exchange: "bybit" | "paper";
  mode: "spot" | "futures";
  aiDecision: AIDecision | null;
  riskCheck: RiskResult | null;
  createdAt: string;
  closedAt: string | null;
}

export interface ClosedPnlRecord {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  closedAt: string;
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
  exchange: "bybit";
  mode: "spot" | "futures";
  currentPrice: number;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    ema?: { ema12: number; ema26: number };
    bollingerBands?: { upper: number; middle: number; lower: number };
    adx?: number;
    atr?: number;
    stochastic?: { k: number; d: number };
  };
  recentCandles: CandleBar[];
  recentTradeOutcomes: Array<{ side: string; pnl: number; reason: string }>;
  marketRegime?: "trending_up" | "trending_down" | "ranging" | "volatile";
  spread: number;
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
  intendedQuantity: number;
  maxSlippagePct: number;
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

// ─── Notifications ────────────────────────────────────
export interface AppNotification {
  id: string;
  type: "trade" | "risk" | "system" | "ai";
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

// ─── Backtest ─────────────────────────────────────────
export interface BacktestTrade {
  side: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  reason: "STOP_LOSS" | "TAKE_PROFIT";
  entryTime: string;
  exitTime: string;
  aiConfidence: number;
}

export interface BacktestResult {
  symbol: string;
  period: string;
  startingBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: BacktestTrade[];
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
