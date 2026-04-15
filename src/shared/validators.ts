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
  exchange: z.enum(["binance", "bybit"]),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export const settingsUpdateSchema = z.object({
  selectedExchange: z.enum(["binance", "bybit"]).optional(),
  tradingMode: z.enum(["spot", "futures"]).optional(),
  agentModeEnabled: z.boolean().optional(),
  themePreference: z.enum(["dark", "light"]).optional(),
  riskProfile: z
    .object({
      maxRiskPct: z.number().min(0.1).max(10).optional(),
      maxDailyLossPct: z.number().min(1).max(20).optional(),
      maxOpenPositions: z.number().int().min(1).max(20).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      maxLeverage: z.number().int().min(1).max(125).optional(),
    })
    .optional(),
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
