// ─── IPC Invoke Channels ───────────────────────────────
export const IPC = {
  AUTH_REGISTER: "auth:register",
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  AUTH_SESSION: "auth:session",

  SETTINGS_SAVE_API_KEYS: "settings:save-api-keys",
  SETTINGS_SAVE_CLAUDE_KEY: "settings:save-claude-key",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",

  PORTFOLIO_GET: "portfolio:get",
  POSITIONS_GET: "positions:get",
  TRADES_HISTORY: "trades:history",

  AI_LAST_DECISION: "ai:last-decision",

  AGENT_START: "agent:start",
  AGENT_STOP: "agent:stop",
  AGENT_KILL_SWITCH: "agent:kill-switch",
  AGENT_RESET_FREEZE: "agent:reset-freeze",

  LOGS_RECENT: "logs:recent",
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
} as const;

// ─── Risk Defaults ─────────────────────────────────────
export const RISK_DEFAULTS = {
  maxRiskPct: 2,
  maxDailyLossPct: 5,
  maxOpenPositions: 3,
  minConfidence: 0.75,
  maxLeverage: 10,
} as const;

// ─── Trading Engine ────────────────────────────────────
export const ENGINE = {
  LOOP_INTERVAL_MS: 8000,
  PRICE_BUFFER_SIZE: 250,
  MIN_BARS_FOR_INDICATORS: 35,
  RSI_PERIOD: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  AI_TIMEOUT_MS: 30000,
  MAX_CONSECUTIVE_LOSSES: 3,
  MAX_DRAWDOWN_PCT: 15,
  WS_RECONNECT_RETRIES: 3,
  EXCHANGE_RETRY_COUNT: 3,
  VOLATILITY_THRESHOLD_PCT: 5,
  SPREAD_THRESHOLD_PCT: 0.5,
} as const;

// ─── Allowed IPC Channels (for preload whitelist) ──────
export const ALLOWED_INVOKE_CHANNELS = Object.values(IPC);
export const ALLOWED_STREAM_CHANNELS = Object.values(STREAM);
