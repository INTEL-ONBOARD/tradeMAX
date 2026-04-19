import mongoose, { Document, Schema } from "mongoose";

export interface IDecisionJournal extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  profile: "scalp" | "intraday" | "swing" | "custom";
  regime: string;
  volatilityBucket: string;
  snapshotId: mongoose.Types.ObjectId | null;
  pipeline: Record<string, unknown>;
  executionResult: Record<string, unknown> | null;
  review: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const decisionJournalSchema = new Schema<IDecisionJournal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, index: true },
    profile: { type: String, enum: ["scalp", "intraday", "swing", "custom"], required: true, index: true },
    regime: { type: String, default: "unknown", index: true },
    volatilityBucket: { type: String, default: "normal", index: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "MarketSnapshot", default: null },
    pipeline: { type: Schema.Types.Mixed, required: true },
    executionResult: { type: Schema.Types.Mixed, default: null },
    review: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

decisionJournalSchema.index({ userId: 1, symbol: 1, profile: 1, createdAt: -1 });
decisionJournalSchema.index({ userId: 1, regime: 1, volatilityBucket: 1, createdAt: -1 });

export const DecisionJournalModel = mongoose.model<IDecisionJournal>("DecisionJournal", decisionJournalSchema);
