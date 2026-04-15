import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../db/models/User.js";
import { registerSchema, loginSchema } from "../shared/validators.js";
import { encrypt } from "./encryptionService.js";
import type { UserSession, UserSettings } from "../shared/types.js";
import { RISK_DEFAULTS } from "../shared/constants.js";

const SALT_ROUNDS = 12;
const JWT_EXPIRY = "24h";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set in environment");
  return secret;
}

function toSession(user: IUser): UserSession {
  return { userId: user._id.toString(), name: user.name, email: user.email };
}

function toSettings(user: IUser): UserSettings {
  return {
    selectedExchange: user.selectedExchange,
    tradingMode: user.tradingMode,
    riskProfile: user.riskProfile,
    agentModeEnabled: user.agentModeEnabled,
    themePreference: user.themePreference,
  };
}

export async function register(data: unknown): Promise<{ session: UserSession; token: string; settings: UserSettings }> {
  const parsed = registerSchema.parse(data);

  const existing = await User.findOne({ email: parsed.email });
  if (existing) throw new Error("EMAIL_EXISTS");

  const hashedPassword = await bcrypt.hash(parsed.password, SALT_ROUNDS);

  const user = await User.create({
    name: parsed.name,
    email: parsed.email,
    password: hashedPassword,
    riskProfile: { ...RISK_DEFAULTS },
  });

  const token = jwt.sign({ userId: user._id.toString() }, getJwtSecret(), { expiresIn: JWT_EXPIRY });

  return { session: toSession(user), token, settings: toSettings(user) };
}

export async function login(data: unknown): Promise<{ session: UserSession; token: string; settings: UserSettings }> {
  const parsed = loginSchema.parse(data);

  const user = await User.findOne({ email: parsed.email });
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(parsed.password, user.password);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  const token = jwt.sign({ userId: user._id.toString() }, getJwtSecret(), { expiresIn: JWT_EXPIRY });

  return { session: toSession(user), token, settings: toSettings(user) };
}

export async function restoreSession(token: string): Promise<{ session: UserSession; settings: UserSettings } | null> {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    const user = await User.findById(payload.userId);
    if (!user) return null;
    return { session: toSession(user), settings: toSettings(user) };
  } catch {
    return null;
  }
}

export async function saveApiKeys(userId: string, exchange: "binance" | "bybit", apiKey: string, apiSecret: string): Promise<void> {
  const encryptedKey = encrypt(apiKey);
  const encryptedSecret = encrypt(apiSecret);

  await User.findByIdAndUpdate(userId, {
    [`exchangeKeys.${exchange}.apiKey`]: encryptedKey,
    [`exchangeKeys.${exchange}.apiSecret`]: encryptedSecret,
  });
}

export async function updateSettings(userId: string, updates: Record<string, unknown>): Promise<UserSettings> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");

  const patch = updates as Partial<UserSettings>;

  if (patch.selectedExchange !== undefined) user.selectedExchange = patch.selectedExchange;
  if (patch.tradingMode !== undefined) user.tradingMode = patch.tradingMode;
  if (patch.agentModeEnabled !== undefined) user.agentModeEnabled = patch.agentModeEnabled;
  if (patch.themePreference !== undefined) user.themePreference = patch.themePreference;
  if (patch.riskProfile) {
    Object.assign(user.riskProfile, patch.riskProfile);
  }

  await user.save();

  return toSettings(user);
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return toSettings(user);
}

export async function getUserDoc(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}
