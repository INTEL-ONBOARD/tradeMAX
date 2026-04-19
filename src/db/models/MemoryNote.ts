import mongoose, { Document, Schema } from "mongoose";

export interface IMemoryNote extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  profile: "scalp" | "intraday" | "swing" | "custom";
  summary: string;
  tags: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const memoryNoteSchema = new Schema<IMemoryNote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, index: true },
    profile: { type: String, enum: ["scalp", "intraday", "swing", "custom"], required: true, index: true },
    summary: { type: String, required: true },
    tags: { type: [String], default: [] },
    priority: { type: Number, default: 0.5 },
  },
  { timestamps: true },
);

memoryNoteSchema.index({ userId: 1, symbol: 1, profile: 1, createdAt: -1 });

export const MemoryNoteModel = mongoose.model<IMemoryNote>("MemoryNote", memoryNoteSchema);
