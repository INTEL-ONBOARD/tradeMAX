import { Schema, model, type InferSchemaType } from "mongoose";

const LogSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
        level: { type: String, enum: ["INFO", "WARN", "ERROR"], required: true },
        category: { type: String, required: true },
        message: { type: String, required: true },
        context: { type: Schema.Types.Mixed, default: {} }
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export type LogDoc = InferSchemaType<typeof LogSchema>;
export const LogModel = model("Log", LogSchema);
