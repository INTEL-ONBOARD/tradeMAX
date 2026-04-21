// ─── User & Auth ───────────────────────────────────────
export interface UserSession {
  userId: string;
  name: string;
  email: string;
}

export type TradingProfile = "scalp" | "intraday" | "swing" | "custom";
export type CritiqueStrictness = "low" | "balanced" | "high";
export type HoldTimeBias = "shorter" | "balanced" | "longer";
export type ExitStylePreference = "fixed" | "trailing" | "hybrid" | "balanced";
export type RegimeState = "trending_up" | "trending_down" | "ranging" | "breakout" | "volatile" | "unknown";
export type VolatilityBucket = "compressed" | "normal" | "expanded" | "violent";
export type TempoFit = "aligned" | "stretched" | "hostile";

export interface StageModelConfig {
  marketAnalyst: string;
  tradeArchitect: string;
  executionCritic: string;
  postTradeReviewer: string;
}

export interface ExchangeSymbolMetadata {
  symbol: string;
  mode: "spot" | "futures";
  qtyStep: number;
  minOrderQty: number;
  minNotionalUsd: number;
  priceTick: number;
  supportsShorts: boolean;
}

export interface SymbolPerformanceSummary {
  symbol: string;
  mode: "spot" | "futures";
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  lastClosedAt: string | null;
}

export interface SymbolSelectionEntry {
  symbol: string;
  mode: "spot" | "futures";
  marketScore: number;
  performanceScore: number;
  compositeScore: number;
  winRate: number;
  sampleSize: number;
  eligible: boolean;
  reason: string;
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
  candidateSymbols: string[];
  tradingProfile: TradingProfile;
  loopIntervalSec: number;
  candleTimeframe: "1m" | "5m" | "15m";
  maxSlippagePct: number;
  tradeCooldownSec: number;
  maxConcurrentSymbols: number;
  symbolReentryCooldownSec: number;
  aiRetryCount: number;
  aiModel: string;
  stageModels: StageModelConfig;
  memoryRetrievalCount: number;
  memoryLookbackDays: number;
  performanceLookbackDays: number;
  minSymbolSampleSize: number;
  minSymbolWinRate: number;
  critiqueStrictness: CritiqueStrictness;
  holdTimeBias: HoldTimeBias;
  exitStylePreference: ExitStylePreference;
  reviewModeEnabled: boolean;
  shadowModeEnabled: boolean;
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

export interface MultiTimeframeCandles {
  timeframe: string;
  candles: CandleBar[];
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

// ─── Market Snapshot ──────────────────────────────────
export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSummary {
  spreadPct: number;
  bestBid: number;
  bestAsk: number;
  bidDepthTop5: number;
  askDepthTop5: number;
  imbalance: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface FuturesMarketContext {
  fundingRate: number | null;
  nextFundingTime: string | null;
  openInterest: number | null;
  openInterestChangePct: number | null;
  basisPct: number | null;
  markPrice: number | null;
  indexPrice: number | null;
  liquidationDistancePctLong: number | null;
  liquidationDistancePctShort: number | null;
  longShortPressure: "longs_crowded" | "shorts_crowded" | "balanced" | "unknown";
}

export interface TempoProfileSnapshot {
  profile: TradingProfile;
  loopIntervalSec: number;
  primaryTimeframes: string[];
  memoryHorizonHours: number;
  maxHoldMinutes: number;
  critiqueStrictness: CritiqueStrictness;
}

export interface SnapshotIntegrity {
  isDataComplete: boolean;
  warnings: string[];
}

export interface MarketSnapshot {
  symbol: string;
  exchange: "bybit";
  mode: "spot" | "futures";
  profile: TempoProfileSnapshot;
  timestamp: string;
  currentPrice: number;
  regimeHint: RegimeState;
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
  recentCandles: CandleBar[];
  multiTimeframeCandles: MultiTimeframeCandles[];
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    ema?: { ema12: number; ema26: number };
    bollingerBands?: { upper: number; middle: number; lower: number };
    adx?: number;
    atr?: number;
    stochastic?: { k: number; d: number };
  };
  orderBook: OrderBookSummary;
  futuresContext: FuturesMarketContext;
  realizedVolatilityPct: number;
  priceChange1hPct: number;
  tempoState: {
    volatilityBucket: VolatilityBucket;
    tempoFit: TempoFit;
  };
  integrity: SnapshotIntegrity;
}

// ─── AI Pipeline ──────────────────────────────────────
export interface MarketAssessment {
  regime: RegimeState;
  volatilityBucket: VolatilityBucket;
  tempoFit: TempoFit;
  directionalBias: "LONG" | "SHORT" | "NEUTRAL";
  conviction: number;
  noTrade: boolean;
  noTradeReasons: string[];
  keyDrivers: string[];
  riskFlags: string[];
  summary: string;
}

export interface TradeProposal {
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  entryZone: {
    min: number;
    max: number;
    preferred: number;
  };
  leverage: number;
  sizeUsd: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPct: number | null;
  maxHoldMinutes: number;
  exitStyle: "fixed" | "trailing" | "hybrid";
  thesis: string;
  invalidation: string;
}

export interface ExecutionReview {
  verdict: "APPROVE" | "DOWNGRADE" | "HOLD";
  finalAction: "BUY" | "SELL" | "HOLD";
  finalConfidence: number;
  adjustedLeverage: number;
  adjustedSizeUsd: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopPct: number | null;
  maxHoldMinutes: number;
  reasons: string[];
  exchangeWarnings: string[];
}

export interface PostTradeReview {
  outcomeLabel: "excellent" | "good" | "neutral" | "poor";
  decisionQualityScore: number;
  executionQualityScore: number;
  riskDisciplineScore: number;
  lessons: string[];
  memoryNote: string;
  summary: string;
}

export interface SelfReviewSummary {
  summary: string;
  memoryNote: string;
  successThemes: string[];
  failureThemes: string[];
  recommendedActions: string[];
  confidence: number;
}

export interface SelfReviewResult {
  reviewId: string;
  userId: string;
  symbol: string;
  profile: TradingProfile;
  reviewedTradeCount: number;
  reviewedJournalCount: number;
  confidence: number;
  summary: string;
  memoryNote: string;
  successThemes: string[];
  failureThemes: string[];
  recommendedActions: string[];
  createdAt: string;
}

export interface RetrievedMemoryCase {
  id: string;
  symbol: string;
  profile: TradingProfile;
  regime: RegimeState;
  volatilityBucket: VolatilityBucket;
  outcomeLabel?: string;
  score: number;
  summary: string;
}

export interface DecisionMemoryEntry {
  _id?: string;
  userId: string;
  symbol: string;
  profile: TradingProfile;
  regime: RegimeState;
  volatilityBucket: VolatilityBucket;
  snapshotId?: string | null;
  pipeline: AgentCycleResult;
  executionResult?: {
    tradeId?: string | null;
    filled: boolean;
    blockedReason?: string | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    pnl?: number | null;
    closedAt?: string | null;
    portfolioSlot?: number | null;
    symbolSelection?: SymbolSelectionEntry | null;
    riskCheck?: RiskResult | null;
  };
  review?: PostTradeReview | null;
  createdAt?: string;
}

export interface MemoryNote {
  _id?: string;
  userId: string;
  symbol: string;
  profile: TradingProfile;
  summary: string;
  tags: string[];
  priority: number;
  createdAt?: string;
}

export interface ProfileConfigRecord {
  _id: string;
  userId: string;
  name: string;
  profile: TradingProfile;
  config: EngineConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AIDecision {
  decision: "BUY" | "SELL" | "HOLD";
  confidence: number;
  entry: number;
  stop_loss: number;
  take_profit: number;
  reason: string;
}

export interface AgentCycleResult {
  cycleId: string;
  timestamp: string;
  symbol: string;
  profile: TradingProfile;
  snapshot: MarketSnapshot;
  retrievedMemories: RetrievedMemoryCase[];
  memorySummary: string;
  marketAssessment: MarketAssessment;
  tradeProposal: TradeProposal;
  executionReview: ExecutionReview;
  finalDecision: AIDecision;
  latencyMs: {
    total: number;
    marketAnalyst: number;
    tradeArchitect: number;
    executionCritic: number;
  };
  status: "READY" | "HOLD" | "ERROR";
  holdReason?: string;
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
  pipelineRun: AgentCycleResult | null;
  memoryReferences: string[];
  portfolioSlot?: number | null;
  selectionRationale?: SymbolSelectionEntry | null;
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

// ─── Legacy AI Prompt ─────────────────────────────────
export interface AIPromptData {
  symbol: string;
  exchange: "bybit";
  mode: "spot" | "futures";
  currentPrice: number;
  indicators: MarketSnapshot["indicators"];
  recentCandles: CandleBar[];
  recentTradeOutcomes: Array<{ side: string; pnl: number; reason: string }>;
  marketRegime?: RegimeState;
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
  activeSymbols: string[];
  leaderboard: SymbolSelectionEntry[];
  lastUpdatedAt?: string;
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
  reason: "STOP_LOSS" | "TAKE_PROFIT" | "TIME_EXIT";
  entryTime: string;
  exitTime: string;
  aiConfidence: number;
  profile?: TradingProfile;
  regime?: RegimeState;
  fold?: number;
}

export interface BacktestRunInput {
  symbol: string;
  startDate: string;
  endDate: string;
  startingBalance: number;
  walkForwardSweep?: boolean;
}

export interface BacktestRegimeBreakdown {
  regime: RegimeState;
  trades: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  averageLatencyMs: number;
}

export interface WalkForwardFoldResult {
  profile: TradingProfile;
  fold: number;
  trainPeriod: string;
  testPeriod: string;
  startingBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  expectancy: number;
  sortinoRatio: number;
  averageAdverseExcursion: number;
  aiRejectionRate: number;
  averageLatencyMs: number;
  regimeBreakdown: BacktestRegimeBreakdown[];
}

export interface WalkForwardEvaluation {
  enabled: true;
  sweepProfiles: TradingProfile[];
  folds: WalkForwardFoldResult[];
  profileResults: Array<{
    profile: TradingProfile;
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
    expectancy: number;
    sortinoRatio: number;
    averageAdverseExcursion: number;
    aiRejectionRate: number;
    averageLatencyMs: number;
    regimeBreakdown: BacktestRegimeBreakdown[];
  }>;
  bestProfile: TradingProfile;
  bestProfileReason: string;
}

export interface BacktestResult {
  symbol: string;
  period: string;
  profile: TradingProfile;
  startingBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  expectancy: number;
  sortinoRatio: number;
  averageAdverseExcursion: number;
  aiRejectionRate: number;
  averageLatencyMs: number;
  regimeBreakdown: BacktestRegimeBreakdown[];
  walkForward?: WalkForwardEvaluation;
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
