import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  exchangeKeys: {
    binance: { apiKey: string; apiSecret: string };
    bybit: { apiKey: string; apiSecret: string };
  };
  selectedExchange: "binance" | "bybit";
  tradingMode: "spot" | "futures";
  riskProfile: {
    maxRiskPct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    minConfidence: number;
    maxLeverage: number;
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
    exchangeKeys: {
      binance: {
        apiKey: { type: String, default: "" },
        apiSecret: { type: String, default: "" },
      },
      bybit: {
        apiKey: { type: String, default: "" },
        apiSecret: { type: String, default: "" },
      },
    },
    selectedExchange: { type: String, enum: ["binance", "bybit"], default: "binance" },
    tradingMode: { type: String, enum: ["spot", "futures"], default: "spot" },
    riskProfile: {
      maxRiskPct: { type: Number, default: 2 },
      maxDailyLossPct: { type: Number, default: 5 },
      maxOpenPositions: { type: Number, default: 3 },
      minConfidence: { type: Number, default: 0.75 },
      maxLeverage: { type: Number, default: 10 },
    },
    agentModeEnabled: { type: Boolean, default: false },
    themePreference: { type: String, enum: ["dark", "light"], default: "dark" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
