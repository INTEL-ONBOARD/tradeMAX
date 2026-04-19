import { z } from "zod";

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

export const engineConfigSchema = z.object({
  tradingSymbol: z.string().min(1).max(20).toUpperCase().optional(),
  autoPairSelection: z.boolean().optional(),
  loopIntervalSec: z.number().min(3).max(120).optional(),
  candleTimeframe: z.enum(["1m", "5m", "15m"]).optional(),
  maxSlippagePct: z.number().min(0.01).max(5).optional(),
  tradeCooldownSec: z.number().min(0).max(600).optional(),
  aiRetryCount: z.number().int().min(0).max(5).optional(),
  aiModel: z.string().min(1).max(100).optional(),
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

export const agentStartSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
});

export const closePositionSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive(),
});
