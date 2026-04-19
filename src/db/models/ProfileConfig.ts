import mongoose, { Document, Schema } from "mongoose";

export interface IProfileConfig extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  profile: "scalp" | "intraday" | "swing" | "custom";
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const profileConfigSchema = new Schema<IProfileConfig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    profile: { type: String, enum: ["scalp", "intraday", "swing", "custom"], required: true, index: true },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

profileConfigSchema.index({ userId: 1, profile: 1, updatedAt: -1 });
profileConfigSchema.index({ userId: 1, profile: 1, name: 1 }, { unique: true });

export const ProfileConfigModel = mongoose.model<IProfileConfig>("ProfileConfig", profileConfigSchema);
