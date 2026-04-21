// ─── IPC Invoke Channels ───────────────────────────────
export const IPC = {
  AUTH_REGISTER: "auth:register",
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  AUTH_SESSION: "auth:session",

  SETTINGS_SAVE_API_KEYS: "settings:save-api-keys",
  SETTINGS_SAVE_OPENAI_KEY: "settings:save-openai-key",
  SETTINGS_REVEAL_KEYS: "settings:reveal-keys",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",

  PORTFOLIO_GET: "portfolio:get",
  POSITIONS_GET: "positions:get",
  POSITION_CLOSE: "position:close",
  TRADES_HISTORY: "trades:history",
  EXCHANGE_CLOSED_PNL: "exchange:closed-pnl",

  AI_LAST_DECISION: "ai:last-decision",
  AI_LIST_MODELS: "ai:list-models",
  AI_SELF_REVIEW: "ai:self-review",

  PROFILE_LIST: "profile:list",
  PROFILE_SAVE: "profile:save",
  PROFILE_APPLY: "profile:apply",
  PROFILE_DELETE: "profile:delete",

  AGENT_START: "agent:start",
  AGENT_STOP: "agent:stop",
  AGENT_KILL_SWITCH: "agent:kill-switch",
  AGENT_RESET_FREEZE: "agent:reset-freeze",

  LOGS_RECENT: "logs:recent",

  EXCHANGE_PAIRS: "exchange:pairs",

  BACKTEST_RUN: "backtest:run",
} as const;

// ─── IPC Stream Events ─────────────────────────────────
export const STREAM = {
  MARKET_TICK: "stream:market-tick",
  PORTFOLIO: "stream:portfolio",
  POSITIONS: "stream:positions",
  TRADE_EXECUTED: "stream:trade-executed",
  AI_DECISION: "stream:ai-decision",
  AGENT_STATUS: "stream:agent-status",
  LOG: "stream:log",
  NOTIFICATION: "stream:notification",
  BACKTEST_PROGRESS: "stream:backtest-progress",
} as const;

// ─── Risk Defaults ─────────────────────────────────────
export const RISK_DEFAULTS = {
  maxRiskPct: 2,
  maxDailyLossPct: 5,
  maxOpenPositions: 3,
  minConfidence: 0.75,
  maxLeverage: 10,
} as const;

// ─── Trading Engine (fixed constants — not user-configurable) ──
export const ENGINE = {
  PRICE_BUFFER_SIZE: 250,
  MIN_BARS_FOR_INDICATORS: 35,
  RSI_PERIOD: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  AI_TIMEOUT_MS: 8000,
  AI_STAGE_TIMEOUT_MS: 2500,
  EXCHANGE_RETRY_COUNT: 3,
  DAILY_PNL_CACHE_CYCLES: 15,
} as const;

// ─── User-configurable engine defaults ─────────────────
export const ENGINE_DEFAULTS = {
  tradingSymbol: "BTCUSDT",
  autoPairSelection: true,
  candidateSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as readonly string[],
  tradingProfile: "intraday" as const,
  loopIntervalSec: 8,
  candleTimeframe: "1m" as const,
  maxSlippagePct: 0.5,
  tradeCooldownSec: 30,
  maxConcurrentSymbols: 2,
  symbolReentryCooldownSec: 120,
  aiRetryCount: 2,
  aiModel: "gpt-5.4-mini",
  stageModels: {
    marketAnalyst: "gpt-5.4-mini",
    tradeArchitect: "gpt-5.4-mini",
    executionCritic: "gpt-5.4-mini",
    postTradeReviewer: "gpt-5.4-mini",
  },
  memoryRetrievalCount: 5,
  memoryLookbackDays: 45,
  performanceLookbackDays: 21,
  minSymbolSampleSize: 4,
  minSymbolWinRate: 0.5,
  critiqueStrictness: "balanced" as const,
  holdTimeBias: "balanced" as const,
  exitStylePreference: "balanced" as const,
  reviewModeEnabled: true,
  shadowModeEnabled: false,
  maxConsecutiveLosses: 3,
  maxDrawdownPct: 15,
  volatilityThresholdPct: 5,
  spreadThresholdPct: 0.5,
  wsReconnectRetries: 5,
  enableEMA: true,
  enableBollingerBands: true,
  enableADX: true,
  enableATR: true,
  enableStochastic: true,
  enableTrailingStop: false,
  trailingStopPct: 1.0,
  paperStartingBalance: 10000,
  watchlist: [] as readonly string[],
  enableMultiModelVoting: false,
  votingModels: ["gpt-5.4-mini", "gpt-5.4-nano"] as readonly string[],
} as const;

export const TRADING_PROFILE_DEFAULTS = {
  scalp: {
    loopIntervalSec: 4,
    timeframes: ["1m", "5m"],
    memoryHorizonHours: 24,
    maxHoldMinutes: 45,
    critiqueStrictness: "high",
  },
  intraday: {
    loopIntervalSec: 12,
    timeframes: ["5m", "15m", "1h"],
    memoryHorizonHours: 96,
    maxHoldMinutes: 480,
    critiqueStrictness: "balanced",
  },
  swing: {
    loopIntervalSec: 60,
    timeframes: ["15m", "1h", "4h"],
    memoryHorizonHours: 336,
    maxHoldMinutes: 4320,
    critiqueStrictness: "balanced",
  },
  custom: {
    loopIntervalSec: 15,
    timeframes: ["1m", "5m", "15m"],
    memoryHorizonHours: 168,
    maxHoldMinutes: 720,
    critiqueStrictness: "balanced",
  },
} as const;

// ─── Allowed IPC Channels (for preload whitelist) ──────
export const ALLOWED_INVOKE_CHANNELS = Object.values(IPC);
export const ALLOWED_STREAM_CHANNELS = Object.values(STREAM);
