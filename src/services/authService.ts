import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserModel } from "../db/models/User.js";
import { DEFAULT_RISK_PROFILE } from "../shared/constants.js";
import { loginSchema, registerSchema } from "../shared/validators.js";
import { encryptSecret } from "./encryptionService.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function toSession(user: any) {
    return {
        userId: String(user._id),
        email: user.email,
        name: user.name,
        agentModeEnabled: user.agentModeEnabled,
        tradingMode: user.tradingMode,
        themePreference: user.themePreference,
        riskProfile: user.riskProfile || DEFAULT_RISK_PROFILE
    };
}

export async function registerUser(input: {
    name: string;
    email: string;
    password: string;
}): Promise<{ token: string; session: ReturnType<typeof toSession> }> {
    const parsed = registerSchema.parse(input);
    const existing = await UserModel.findOne({ email: parsed.email.toLowerCase() });
    if (existing) {
        throw new Error("Email already in use");
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const user = await UserModel.create({
        name: parsed.name,
        email: parsed.email.toLowerCase(),
        passwordHash
    });

    const session = toSession(user);
    const token = jwt.sign({ sub: session.userId, email: session.email }, JWT_SECRET, { expiresIn: "7d" });
    return { token, session };
}

export async function loginUser(input: {
    email: string;
    password: string;
}): Promise<{ token: string; session: ReturnType<typeof toSession> }> {
    const parsed = loginSchema.parse(input);
    const user = await UserModel.findOne({ email: parsed.email.toLowerCase() });
    if (!user) {
        throw new Error("Invalid credentials");
    }

    const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!isValid) {
        throw new Error("Invalid credentials");
    }

    const session = toSession(user);
    const token = jwt.sign({ sub: session.userId, email: session.email }, JWT_SECRET, { expiresIn: "7d" });
    return { token, session };
}

export async function updateApiKeys(
    userId: string,
    keys: { binanceKey?: string; binanceSecret?: string; bybitKey?: string; bybitSecret?: string }
): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
        $set: {
            ...(keys.binanceKey !== undefined ? { "encryptedApiKeys.binanceKey": encryptSecret(keys.binanceKey) } : {}),
            ...(keys.binanceSecret !== undefined ? { "encryptedApiKeys.binanceSecret": encryptSecret(keys.binanceSecret) } : {}),
            ...(keys.bybitKey !== undefined ? { "encryptedApiKeys.bybitKey": encryptSecret(keys.bybitKey) } : {}),
            ...(keys.bybitSecret !== undefined ? { "encryptedApiKeys.bybitSecret": encryptSecret(keys.bybitSecret) } : {})
        }
    });
}

export function verifyToken(token: string): { sub: string; email: string } {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
}

export async function getSessionFromToken(token: string) {
    const decoded = verifyToken(token);
    const user = await UserModel.findById(decoded.sub);
    if (!user) {
        throw new Error("Session invalid");
    }
    return toSession(user);
}

export async function updateUserSettings(
    userId: string,
    patch: Partial<{ tradingMode: "spot" | "futures"; agentModeEnabled: boolean; riskProfile: Record<string, number>; themePreference: "dark" | "light" }>
): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, { $set: patch });
}
