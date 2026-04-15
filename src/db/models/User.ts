import { Schema, model, type InferSchemaType } from "mongoose";
import { DEFAULT_RISK_PROFILE } from "../../shared/constants.js";

const UserSchema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
        encryptedApiKeys: {
            binanceKey: { type: String, default: "" },
            binanceSecret: { type: String, default: "" },
            bybitKey: { type: String, default: "" },
            bybitSecret: { type: String, default: "" }
        },
        tradingMode: { type: String, enum: ["spot", "futures"], default: "spot" },
        riskProfile: {
            maxRiskPerTradePct: { type: Number, default: DEFAULT_RISK_PROFILE.maxRiskPerTradePct },
            maxDailyLossPct: { type: Number, default: DEFAULT_RISK_PROFILE.maxDailyLossPct },
            maxOpenPositions: { type: Number, default: DEFAULT_RISK_PROFILE.maxOpenPositions },
            minConfidence: { type: Number, default: DEFAULT_RISK_PROFILE.minConfidence },
            maxSpreadPct: { type: Number, default: DEFAULT_RISK_PROFILE.maxSpreadPct },
            maxVolatilityPct: { type: Number, default: DEFAULT_RISK_PROFILE.maxVolatilityPct },
            maxLeverage: { type: Number, default: DEFAULT_RISK_PROFILE.maxLeverage },
            maxDrawdownPct: { type: Number, default: DEFAULT_RISK_PROFILE.maxDrawdownPct }
        },
        agentModeEnabled: { type: Boolean, default: false },
        themePreference: { type: String, enum: ["dark", "light"], default: "dark" }
    },
    { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };
export const UserModel = model("User", UserSchema);
