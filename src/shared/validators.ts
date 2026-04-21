import { z } from "zod";

const stageModelConfigSchema = z.object({
  marketAnalyst: z.string().min(1).max(100),
  tradeArchitect: z.string().min(1).max(100),
  executionCritic: z.string().min(1).max(100),
  postTradeReviewer: z.string().min(1).max(100),
});

export const registerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const apiKeysSchema = z.object({
  exchange: z.enum(["bybit", "paper"]),
  apiKey: z.string(),
  apiSecret: z.string(),
}).superRefine((data, ctx) => {
  if (data.exchange === "paper") return;

  if (data.apiKey.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiKey"],
      message: "API key is required",
    });
  }

  if (data.apiSecret.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["apiSecret"],
      message: "API secret is required",
    });
  }
});

export const openaiKeySchema = z.object({
  openaiApiKey: z.string().min(1),
});

const notificationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  desktopEnabled: z.boolean().optional(),
  trade: z.boolean().optional(),
  risk: z.boolean().optional(),
  system: z.boolean().optional(),
  ai: z.boolean().optional(),
});

export const engineConfigSchema = z.object({
  tradingSymbol: z.string().min(1).max(20).toUpperCase().optional(),
  autoPairSelection: z.boolean().optional(),
  restrictAutoPairSelectionToShortlist: z.boolean().optional(),
  candidateSymbols: z.array(z.string().min(1).max(20).toUpperCase()).max(20).optional(),
  tradingProfile: z.enum(["scalp", "intraday", "swing", "custom"]).optional(),
  loopIntervalSec: z.number().min(3).max(120).optional(),
  candleTimeframe: z.enum(["1m", "5m", "15m"]).optional(),
  maxSlippagePct: z.number().min(0.01).max(5).optional(),
  tradeCooldownSec: z.number().min(0).max(600).optional(),
  maxConcurrentSymbols: z.number().int().min(1).max(10).optional(),
  symbolReentryCooldownSec: z.number().int().min(0).max(3600).optional(),
  aiRetryCount: z.number().int().min(0).max(5).optional(),
  aiModel: z.string().min(1).max(100).optional(),
  stageModels: stageModelConfigSchema.partial().optional(),
  memoryRetrievalCount: z.number().int().min(1).max(20).optional(),
  memoryLookbackDays: z.number().int().min(1).max(365).optional(),
  performanceLookbackDays: z.number().int().min(1).max(180).optional(),
  minSymbolSampleSize: z.number().int().min(1).max(50).optional(),
  minSymbolWinRate: z.number().min(0).max(1).optional(),
  critiqueStrictness: z.enum(["low", "balanced", "high"]).optional(),
  holdTimeBias: z.enum(["shorter", "balanced", "longer"]).optional(),
  exitStylePreference: z.enum(["fixed", "trailing", "hybrid", "balanced"]).optional(),
  reviewModeEnabled: z.boolean().optional(),
  shadowModeEnabled: z.boolean().optional(),
  maxConsecutiveLosses: z.number().int().min(1).max(20).optional(),
  maxDrawdownPct: z.number().min(1).max(50).optional(),
  volatilityThresholdPct: z.number().min(0.5).max(20).optional(),
  spreadThresholdPct: z.number().min(0.01).max(5).optional(),
  wsReconnectRetries: z.number().int().min(1).max(20).optional(),
  enableEMA: z.boolean().optional(),
  enableBollingerBands: z.boolean().optional(),
  enableADX: z.boolean().optional(),
  enableATR: z.boolean().optional(),
  enableStochastic: z.boolean().optional(),
  enableTrailingStop: z.boolean().optional(),
  trailingStopPct: z.number().min(0.1).max(10).optional(),
  paperStartingBalance: z.number().min(100).max(1000000).optional(),
  watchlist: z.array(z.string().toUpperCase()).max(10).optional(),
  enableMultiModelVoting: z.boolean().optional(),
  votingModels: z.array(z.string()).max(3).optional(),
});

export const settingsUpdateSchema = z.object({
  selectedExchange: z.enum(["bybit", "paper"]).optional(),
  tradingMode: z.enum(["spot", "futures"]).optional(),
  agentModeEnabled: z.boolean().optional(),
  themePreference: z.enum(["dark", "light"]).optional(),
  notificationSettings: notificationSettingsSchema.optional(),
  riskProfile: z
    .object({
      maxRiskPct: z.number().min(0.1).max(10).optional(),
      maxDailyLossPct: z.number().min(1).max(20).optional(),
      maxOpenPositions: z.number().int().min(1).max(20).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      maxLeverage: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
  engineConfig: engineConfigSchema.optional(),
});

export const aiDecisionSchema = z.object({
  decision: z.enum(["BUY", "SELL", "HOLD"]),
  confidence: z.number().min(0).max(1),
  entry: z.number().positive(),
  stop_loss: z.number().positive(),
  take_profit: z.number().positive(),
  reason: z.string().min(1),
});

export const marketAssessmentSchema = z.object({
  regime: z.enum(["trending_up", "trending_down", "ranging", "breakout", "volatile", "unknown"]),
  volatilityBucket: z.enum(["compressed", "normal", "expanded", "violent"]),
  tempoFit: z.enum(["aligned", "stretched", "hostile"]),
  directionalBias: z.enum(["LONG", "SHORT", "NEUTRAL"]),
  conviction: z.number().min(0).max(1),
  noTrade: z.boolean(),
  noTradeReasons: z.array(z.string()),
  keyDrivers: z.array(z.string()).max(8),
  riskFlags: z.array(z.string()).max(8),
  summary: z.string().min(1),
});

export const tradeProposalSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD"]),
  confidence: z.number().min(0).max(1),
  entryZone: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    preferred: z.number().positive(),
  }),
  leverage: z.number().min(1).max(100),
  sizeUsd: z.number().min(0),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  trailingStopPct: z.number().min(0.05).max(25).nullable(),
  maxHoldMinutes: z.number().int().min(1).max(10080),
  exitStyle: z.enum(["fixed", "trailing", "hybrid"]),
  thesis: z.string().min(1),
  invalidation: z.string().min(1),
});

export const executionReviewSchema = z.object({
  verdict: z.enum(["APPROVE", "DOWNGRADE", "HOLD"]),
  finalAction: z.enum(["BUY", "SELL", "HOLD"]),
  finalConfidence: z.number().min(0).max(1),
  adjustedLeverage: z.number().min(1).max(100),
  adjustedSizeUsd: z.number().min(0),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  trailingStopPct: z.number().min(0.05).max(25).nullable(),
  maxHoldMinutes: z.number().int().min(1).max(10080),
  reasons: z.array(z.string()).max(8),
  exchangeWarnings: z.array(z.string()).max(8),
});

export const postTradeReviewSchema = z.object({
  outcomeLabel: z.enum(["excellent", "good", "neutral", "poor"]),
  decisionQualityScore: z.number().min(0).max(1),
  executionQualityScore: z.number().min(0).max(1),
  riskDisciplineScore: z.number().min(0).max(1),
  lessons: z.array(z.string()).max(10),
  memoryNote: z.string().min(1),
  summary: z.string().min(1),
});

export const selfReviewSchema = z.object({
  summary: z.string().min(1),
  memoryNote: z.string().min(1),
  successThemes: z.array(z.string()).max(8),
  failureThemes: z.array(z.string()).max(8),
  recommendedActions: z.array(z.string()).max(8),
  confidence: z.number().min(0).max(1),
});

export const profileConfigSaveSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  profile: z.enum(["scalp", "intraday", "swing", "custom"]),
  config: engineConfigSchema,
});

export const profileConfigIdSchema = z.object({
  id: z.string().min(1),
});

export const selfReviewRequestSchema = z.object({
  force: z.boolean().optional(),
});

export const agentStartSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
});

export const closePositionSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
});
