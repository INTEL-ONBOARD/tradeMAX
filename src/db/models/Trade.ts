import { Schema, model, type InferSchemaType } from "mongoose";

const TradeSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        exchange: { type: String, enum: ["binance", "bybit"], required: true },
        symbol: { type: String, required: true },
        side: { type: String, enum: ["BUY", "SELL"], required: true },
        orderType: { type: String, default: "MARKET" },
        quantity: { type: Number, required: true },
        entry: { type: Number, required: true },
        exit: { type: Number, default: null },
        pnl: { type: Number, default: 0 },
        source: { type: String, enum: ["Claude", "manual", "system"], required: true },
        status: { type: String, enum: ["OPEN", "CLOSED", "CANCELED", "REJECTED"], default: "OPEN" },
        metadata: { type: Schema.Types.Mixed, default: {} }
    },
    { timestamps: true }
);

export type TradeDoc = InferSchemaType<typeof TradeSchema>;
export const TradeModel = model("Trade", TradeSchema);
