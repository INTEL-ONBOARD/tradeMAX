import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  encryptionSalt: string;
  exchangeKeys: {
    bybit: { apiKey: string; apiSecret: string };
  };
  claudeApiKey: string;
  selectedExchange: "bybit" | "paper";
  tradingMode: "spot" | "futures";
  riskProfile: {
    maxRiskPct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    minConfidence: number;
    maxLeverage: number;
  };
  engineConfig: {
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
  };
  agentModeEnabled: boolean;
  themePreference: "dark" | "light";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    encryptionSalt: { type: String, default: "" },
    exchangeKeys: {
      bybit: {
        apiKey: { type: String, default: "" },
        apiSecret: { type: String, default: "" },
      },
    },
    claudeApiKey: { type: String, default: "" },
    selectedExchange: { type: String, enum: ["bybit", "paper"], default: "bybit" },
    tradingMode: { type: String, enum: ["spot", "futures"], default: "spot" },
    riskProfile: {
      maxRiskPct: { type: Number, default: 2 },
      maxDailyLossPct: { type: Number, default: 5 },
      maxOpenPositions: { type: Number, default: 3 },
      minConfidence: { type: Number, default: 0.75 },
      maxLeverage: { type: Number, default: 10 },
    },
    engineConfig: {
      tradingSymbol: { type: String, default: "BTCUSDT" },
      autoPairSelection: { type: Boolean, default: false },
      loopIntervalSec: { type: Number, default: 8 },
      candleTimeframe: { type: String, enum: ["1m", "5m", "15m"], default: "1m" },
      maxSlippagePct: { type: Number, default: 0.5 },
      tradeCooldownSec: { type: Number, default: 30 },
      aiRetryCount: { type: Number, default: 2 },
      aiModel: { type: String, default: "claude-sonnet-4-20250514" },
      maxConsecutiveLosses: { type: Number, default: 3 },
      maxDrawdownPct: { type: Number, default: 15 },
      volatilityThresholdPct: { type: Number, default: 5 },
      spreadThresholdPct: { type: Number, default: 0.5 },
      wsReconnectRetries: { type: Number, default: 5 },
      enableEMA: { type: Boolean, default: true },
      enableBollingerBands: { type: Boolean, default: true },
      enableADX: { type: Boolean, default: true },
      enableATR: { type: Boolean, default: true },
      enableStochastic: { type: Boolean, default: true },
      enableTrailingStop: { type: Boolean, default: false },
      trailingStopPct: { type: Number, default: 1.0 },
      paperStartingBalance: { type: Number, default: 10000 },
      watchlist: { type: [String], default: [] },
      enableMultiModelVoting: { type: Boolean, default: false },
      votingModels: { type: [String], default: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] },
    },
    agentModeEnabled: { type: Boolean, default: false },
    themePreference: { type: String, enum: ["dark", "light"], default: "light" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
