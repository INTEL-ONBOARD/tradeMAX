import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../db/models/User.js";
import { registerSchema, loginSchema } from "../shared/validators.js";
import { encrypt, generateUserSalt } from "./encryptionService.js";
import type { UserSession, UserSettings } from "../shared/types.js";
import { RISK_DEFAULTS, ENGINE_DEFAULTS } from "../shared/constants.js";
import { ConfigSnapshotModel } from "../db/models/ConfigSnapshot.js";

const SALT_ROUNDS = 12;
const JWT_EXPIRY = "30d";

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(email: string): void {
  const record = loginAttempts.get(email);
  if (!record) return;

  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(email);
    return;
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const remainingMin = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
    throw new Error(`RATE_LIMITED: Too many login attempts. Try again in ${remainingMin} minutes.`);
  }
}

function recordFailedLogin(email: string): void {
  const record = loginAttempts.get(email) ?? { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  loginAttempts.set(email, record);
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set in environment");
  return secret;
}

function toSession(user: IUser): UserSession {
  return { userId: user._id.toString(), name: user.name, email: user.email };
}

function toSettings(user: IUser): UserSettings {
  // JSON round-trip strips Mongoose internals that can't be cloned via Electron IPC
  return JSON.parse(JSON.stringify({
    selectedExchange: user.selectedExchange,
    tradingMode: user.tradingMode,
    riskProfile: user.riskProfile,
    engineConfig: user.engineConfig,
    agentModeEnabled: user.agentModeEnabled,
    themePreference: user.themePreference,
    hasClaudeKey: !!user.claudeApiKey,
    hasBinanceKeys: !!(user.exchangeKeys.binance.apiKey && user.exchangeKeys.binance.apiSecret),
    hasBybitKeys: !!(user.exchangeKeys.bybit.apiKey && user.exchangeKeys.bybit.apiSecret),
  }));
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
    encryptionSalt: generateUserSalt(),
    riskProfile: { ...RISK_DEFAULTS },
    engineConfig: { ...ENGINE_DEFAULTS },
  });

  const token = jwt.sign({ userId: user._id.toString() }, getJwtSecret(), { expiresIn: JWT_EXPIRY });

  return { session: toSession(user), token, settings: toSettings(user) };
}

export async function login(data: unknown): Promise<{ session: UserSession; token: string; settings: UserSettings }> {
  const parsed = loginSchema.parse(data);

  checkLoginRateLimit(parsed.email);

  const user = await User.findOne({ email: parsed.email });
  if (!user) {
    recordFailedLogin(parsed.email);
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(parsed.password, user.password);
  if (!valid) {
    recordFailedLogin(parsed.email);
    throw new Error("INVALID_CREDENTIALS");
  }

  clearLoginAttempts(parsed.email);

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

export async function saveApiKeys(userId: string, exchange: "binance" | "bybit", apiKey: string, apiSecret: string): Promise<UserSettings> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const userSalt = user.encryptionSalt || undefined;
  const encryptedKey = encrypt(apiKey, userSalt);
  const encryptedSecret = encrypt(apiSecret, userSalt);

  const updated = await User.findByIdAndUpdate(userId, {
    [`exchangeKeys.${exchange}.apiKey`]: encryptedKey,
    [`exchangeKeys.${exchange}.apiSecret`]: encryptedSecret,
  }, { new: true });
  if (!updated) throw new Error("USER_NOT_FOUND");
  return toSettings(updated);
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
  if (patch.engineConfig) {
    Object.assign(user.engineConfig, patch.engineConfig);
  }

  await user.save();

  await ConfigSnapshotModel.create({
    userId,
    settings: {
      riskProfile: user.riskProfile,
      engineConfig: user.engineConfig,
      selectedExchange: user.selectedExchange,
      tradingMode: user.tradingMode,
    },
  }).catch(() => {}); // non-critical, don't block settings update

  return toSettings(user);
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return toSettings(user);
}

export async function saveClaudeKey(userId: string, claudeApiKey: string): Promise<UserSettings> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const userSalt = user.encryptionSalt || undefined;
  const encryptedKey = encrypt(claudeApiKey, userSalt);
  const updated = await User.findByIdAndUpdate(userId, { claudeApiKey: encryptedKey }, { new: true });
  if (!updated) throw new Error("USER_NOT_FOUND");
  return toSettings(updated);
}

export async function getUserDoc(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}
