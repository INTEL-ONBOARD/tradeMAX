import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId;
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
  aiDecision: Record<string, unknown> | null;
  riskCheck: Record<string, unknown> | null;
  pipelineRun: Record<string, unknown> | null;
  memoryReferences: string[];
  createdAt: Date;
  closedAt: Date | null;
}

const tradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true },
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    type: { type: String, enum: ["MARKET", "LIMIT"], default: "MARKET" },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    quantity: { type: Number, required: true },
    pnl: { type: Number, default: null },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    source: { type: String, enum: ["AI", "MANUAL", "SYSTEM"], default: "AI" },
    exchange: { type: String, enum: ["bybit", "paper"], required: true },
    mode: { type: String, enum: ["spot", "futures"], required: true },
    aiDecision: { type: Schema.Types.Mixed, default: null },
    riskCheck: { type: Schema.Types.Mixed, default: null },
    pipelineRun: { type: Schema.Types.Mixed, default: null },
    memoryReferences: { type: [String], default: [] },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tradeSchema.index({ userId: 1, status: 1, closedAt: -1 });
tradeSchema.index({ userId: 1, status: 1 });
tradeSchema.index({ closedAt: 1 }); // For archival queries

export const TradeModel = mongoose.model<ITrade>("Trade", tradeSchema);
