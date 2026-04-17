import mongoose, { Schema, Document } from "mongoose";

export interface IConfigSnapshot extends Document {
  userId: mongoose.Types.ObjectId;
  settings: Record<string, unknown>;
  createdAt: Date;
}

const configSnapshotSchema = new Schema<IConfigSnapshot>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  settings: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

// Keep only last 50 snapshots per user via TTL
configSnapshotSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

export const ConfigSnapshotModel = mongoose.model<IConfigSnapshot>("ConfigSnapshot", configSnapshotSchema);
