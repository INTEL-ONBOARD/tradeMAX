import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  encryptionSalt: string;
  exchangeKeys: {
    bybit: { apiKey: string; apiSecret: string };
  };
  openaiApiKey: string;
  claudeApiKey?: string;
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
    restrictAutoPairSelectionToShortlist: boolean;
    candidateSymbols: string[];
    tradingProfile: "scalp" | "intraday" | "swing" | "custom";
    loopIntervalSec: number;
    candleTimeframe: "1m" | "5m" | "15m";
    maxSlippagePct: number;
    tradeCooldownSec: number;
    maxConcurrentSymbols: number;
    symbolReentryCooldownSec: number;
    aiRetryCount: number;
    aiModel: string;
    stageModels: {
      marketAnalyst: string;
      tradeArchitect: string;
      executionCritic: string;
      postTradeReviewer: string;
    };
    memoryRetrievalCount: number;
    memoryLookbackDays: number;
    performanceLookbackDays: number;
    minSymbolSampleSize: number;
    minSymbolWinRate: number;
    critiqueStrictness: "low" | "balanced" | "high";
    holdTimeBias: "shorter" | "balanced" | "longer";
    exitStylePreference: "fixed" | "trailing" | "hybrid" | "balanced";
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
  };
  notificationSettings: {
    enabled: boolean;
    desktopEnabled: boolean;
    trade: boolean;
    risk: boolean;
    system: boolean;
    ai: boolean;
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
    openaiApiKey: { type: String, default: "" },
    claudeApiKey: { type: String, default: "" }, // legacy fallback for pre-OpenAI installs
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
      autoPairSelection: { type: Boolean, default: true },
      restrictAutoPairSelectionToShortlist: { type: Boolean, default: false },
      candidateSymbols: { type: [String], default: [] },
      tradingProfile: { type: String, enum: ["scalp", "intraday", "swing", "custom"], default: "intraday" },
      loopIntervalSec: { type: Number, default: 8 },
      candleTimeframe: { type: String, enum: ["1m", "5m", "15m"], default: "1m" },
      maxSlippagePct: { type: Number, default: 0.5 },
      tradeCooldownSec: { type: Number, default: 30 },
      maxConcurrentSymbols: { type: Number, default: 2 },
      symbolReentryCooldownSec: { type: Number, default: 120 },
      aiRetryCount: { type: Number, default: 2 },
      aiModel: { type: String, default: "gpt-5.4-mini" },
      stageModels: {
        marketAnalyst: { type: String, default: "gpt-5.4-mini" },
        tradeArchitect: { type: String, default: "gpt-5.4-mini" },
        executionCritic: { type: String, default: "gpt-5.4-mini" },
        postTradeReviewer: { type: String, default: "gpt-5.4-mini" },
      },
      memoryRetrievalCount: { type: Number, default: 5 },
      memoryLookbackDays: { type: Number, default: 45 },
      performanceLookbackDays: { type: Number, default: 21 },
      minSymbolSampleSize: { type: Number, default: 4 },
      minSymbolWinRate: { type: Number, default: 0.5 },
      critiqueStrictness: { type: String, enum: ["low", "balanced", "high"], default: "balanced" },
      holdTimeBias: { type: String, enum: ["shorter", "balanced", "longer"], default: "balanced" },
      exitStylePreference: { type: String, enum: ["fixed", "trailing", "hybrid", "balanced"], default: "balanced" },
      reviewModeEnabled: { type: Boolean, default: true },
      shadowModeEnabled: { type: Boolean, default: false },
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
      votingModels: { type: [String], default: ["gpt-5.4-mini", "gpt-5.4-nano"] },
    },
    notificationSettings: {
      enabled: { type: Boolean, default: true },
      desktopEnabled: { type: Boolean, default: true },
      trade: { type: Boolean, default: true },
      risk: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      ai: { type: Boolean, default: true },
    },
    agentModeEnabled: { type: Boolean, default: false },
    themePreference: { type: String, enum: ["dark", "light"], default: "light" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
