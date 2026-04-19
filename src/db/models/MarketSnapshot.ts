import mongoose, { Document, Schema } from "mongoose";

export interface IMarketSnapshot extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  profile: "scalp" | "intraday" | "swing" | "custom";
  snapshot: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const marketSnapshotSchema = new Schema<IMarketSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, index: true },
    profile: { type: String, enum: ["scalp", "intraday", "swing", "custom"], required: true, index: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

marketSnapshotSchema.index({ userId: 1, symbol: 1, createdAt: -1 });

export const MarketSnapshotModel = mongoose.model<IMarketSnapshot>("MarketSnapshot", marketSnapshotSchema);
