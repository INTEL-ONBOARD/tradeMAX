import mongoose, { Schema, Document } from "mongoose";

export interface ILog extends Document {
  userId: mongoose.Types.ObjectId;
  level: "INFO" | "WARN" | "ERROR";
  category: "AUTH" | "TRADE" | "AI" | "RISK" | "SAFETY" | "SYSTEM";
  message: string;
  meta: Record<string, unknown>;
  timestamp: Date;
}

const logSchema = new Schema<ILog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  level: { type: String, enum: ["INFO", "WARN", "ERROR"], required: true },
  category: { type: String, enum: ["AUTH", "TRADE", "AI", "RISK", "SAFETY", "SYSTEM"], required: true },
  message: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const LogModel = mongoose.model<ILog>("Log", logSchema);
