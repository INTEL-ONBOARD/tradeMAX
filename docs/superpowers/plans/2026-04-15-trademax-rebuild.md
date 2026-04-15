# TradeMAX Full Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild TradeMAX from scratch as a production-grade autonomous crypto trading Electron desktop app with AI-driven trade signals, strict risk management, and hard safety controls.

**Architecture:** Monolithic Electron main process holds all business logic (auth, encryption, exchange APIs, AI, risk engine, trade engine, safety). React renderer is a pure display layer communicating only through a typed IPC bridge (preload contextBridge). Single exchange per session. MongoDB Atlas for persistence.

**Tech Stack:** Electron 34, React 18, TypeScript 5, Vite 6, Mongoose 8, Zustand 5, TailwindCSS 3, Framer Motion 12, bcrypt, jsonwebtoken, @anthropic-ai/sdk, ws, bybit-api, axios, technicalindicators, zod, electron-store

---

## Phase 1: Project Scaffold & Foundation

### Task 1: Clean Slate + Project Config

**Files:**
- Delete: all files in `src/` (full rebuild)
- Create: `package.json` (rewrite)
- Create: `.env.example`
- Create: `.gitignore`
- Create: `tsconfig.base.json`
- Create: `tsconfig.main.json`
- Create: `tsconfig.preload.json`
- Create: `tsconfig.renderer.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.cjs`
- Create: `postcss.config.cjs`

- [ ] **Step 1: Delete existing src directory**

```bash
rm -rf src/
```

- [ ] **Step 2: Write package.json**

```json
{
  "name": "trademax-desktop",
  "version": "2.0.0",
  "description": "Autonomous crypto trading desktop app with hard safety controls",
  "main": "dist/main/main.js",
  "author": "tradeMAX",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:renderer\" \"npm:dev:main\" \"npm:dev:preload\" \"npm:dev:electron\"",
    "dev:renderer": "vite",
    "dev:main": "tsc -p tsconfig.main.json --watch",
    "dev:preload": "tsc -p tsconfig.preload.json --watch",
    "dev:electron": "wait-on tcp:5173 dist/main/main.js dist/preload/preload/index.js && nodemon --watch dist/main --watch dist/preload --ext js --exec \"cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .\"",
    "build": "npm run build:renderer && npm run build:main && npm run build:preload",
    "build:renderer": "vite build",
    "build:main": "tsc -p tsconfig.main.json",
    "build:preload": "tsc -p tsconfig.preload.json"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.51.0",
    "axios": "^1.9.0",
    "bcrypt": "^5.1.1",
    "bybit-api": "^4.3.7",
    "clsx": "^2.1.1",
    "dotenv": "^16.5.0",
    "electron-store": "^10.1.0",
    "framer-motion": "^12.10.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.14.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^3.3.0",
    "technicalindicators": "^3.1.0",
    "ws": "^8.18.2",
    "zod": "^3.24.3",
    "zustand": "^5.0.5"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^22.15.3",
    "@types/react": "^18.3.20",
    "@types/react-dom": "^18.3.6",
    "@types/ws": "^8.18.1",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "concurrently": "^9.1.2",
    "cross-env": "^7.0.3",
    "electron": "^34.5.5",
    "electron-builder": "^25.1.8",
    "nodemon": "^3.1.10",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "wait-on": "^8.0.3"
  },
  "build": {
    "appId": "com.trademax.desktop",
    "productName": "TradeMAX",
    "files": ["dist/**/*", "package.json"],
    "mac": {
      "target": "dmg",
      "category": "public.app-category.finance"
    }
  }
}
```

- [ ] **Step 3: Write .env.example**

```env
# App
NODE_ENV=development
JWT_SECRET=replace_with_64_char_random_hex
APP_MASTER_KEY=replace_with_64_char_random_hex

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Claude AI
CLAUDE_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-sonnet-4-20250514

# Defaults
DEFAULT_SYMBOL=BTCUSDT
```

- [ ] **Step 4: Write .gitignore**

```
node_modules
.DS_Store
dist
.env
.env.*
!.env.example
coverage
*.log
.superpowers
```

- [ ] **Step 5: Write tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Write tsconfig.main.json**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist/main",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/services/**/*", "src/db/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 7: Write tsconfig.preload.json**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist/preload",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/preload/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 8: Write tsconfig.renderer.json**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["vite/client"],
    "paths": {
      "@renderer/*": ["./src/renderer/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/renderer/**/*", "src/shared/**/*"]
}
```

- [ ] **Step 9: Write vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: path.resolve(process.cwd(), "dist/renderer"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@renderer": path.resolve(process.cwd(), "src/renderer"),
      "@shared": path.resolve(process.cwd(), "src/shared"),
    },
  },
});
```

- [ ] **Step 10: Write tailwind.config.cjs**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{tsx,ts,html}"],
  theme: {
    extend: {
      colors: {
        primary: "#5A189A",
        accent: "#FFD60A",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 11: Write postcss.config.cjs**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 12: Install dependencies**

```bash
rm -rf node_modules package-lock.json && npm install
```

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: clean slate project scaffold for v2 rebuild"
```

---

### Task 2: Shared Types, Constants & Validators

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/constants.ts`
- Create: `src/shared/validators.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/shared src/main src/preload src/renderer src/services src/db/models
```

- [ ] **Step 2: Write src/shared/types.ts**

```typescript
// ─── User & Auth ───────────────────────────────────────
export interface UserSession {
  userId: string;
  name: string;
  email: string;
}

export interface UserSettings {
  selectedExchange: "binance" | "bybit";
  tradingMode: "spot" | "futures";
  riskProfile: RiskProfile;
  agentModeEnabled: boolean;
  themePreference: "dark" | "light";
}

export interface RiskProfile {
  maxRiskPct: number;
  maxDailyLossPct: number;
  maxOpenPositions: number;
  minConfidence: number;
  maxLeverage: number;
}

// ─── Portfolio ─────────────────────────────────────────
export interface PortfolioSnapshot {
  totalBalance: number;
  availableBalance: number;
  dailyPnl: number;
  weeklyPnl: number;
}

// ─── Positions & Trades ───────────────────────────────
export interface Position {
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  markPrice: number;
  quantity: number;
  unrealizedPnl: number;
  liquidationPrice: number | null;
}

export interface Trade {
  _id: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnl: number | null;
  status: "OPEN" | "CLOSED";
  source: "AI" | "MANUAL" | "SYSTEM";
  exchange: "binance" | "bybit";
  mode: "spot" | "futures";
  aiDecision: AIDecision | null;
  riskCheck: RiskResult | null;
  createdAt: string;
  closedAt: string | null;
}

// ─── AI ────────────────────────────────────────────────
export interface AIDecision {
  decision: "BUY" | "SELL" | "HOLD";
  confidence: number;
  entry: number;
  stop_loss: number;
  take_profit: number;
  reason: string;
}

export interface AIPromptData {
  symbol: string;
  exchange: "binance" | "bybit";
  mode: "spot" | "futures";
  currentPrice: number;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
  };
  portfolio: PortfolioSnapshot;
  openPositions: Position[];
  riskProfile: RiskProfile;
}

// ─── Risk ──────────────────────────────────────────────
export interface RiskResult {
  approved: boolean;
  passed: string[];
  failed: string[];
  reasons: string[];
}

export interface RiskContext {
  decision: AIDecision;
  portfolio: PortfolioSnapshot;
  openTradeCount: number;
  dailyRealizedLoss: number;
  priceChange1h: number;
  spread: number;
  peakBalance: number;
  riskProfile: RiskProfile;
  tradingMode: "spot" | "futures";
}

// ─── Safety ────────────────────────────────────────────
export interface SafetyState {
  frozen: boolean;
  frozenReason: "KILL_SWITCH" | "CONSECUTIVE_LOSSES" | "DRAWDOWN" | "API_FAILURE" | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}

// ─── Agent ─────────────────────────────────────────────
export interface AgentStatus {
  running: boolean;
  frozen: boolean;
  reason?: string;
}

// ─── Market ────────────────────────────────────────────
export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface PriceBar {
  price: number;
  timestamp: number;
}

// ─── Exchange ──────────────────────────────────────────
export interface OrderResult {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  status: string;
}

export interface ExchangeKeys {
  apiKey: string;
  apiSecret: string;
}

// ─── Logs ──────────────────────────────────────────────
export type LogLevel = "INFO" | "WARN" | "ERROR";
export type LogCategory = "AUTH" | "TRADE" | "AI" | "RISK" | "SAFETY" | "SYSTEM";

export interface LogEntry {
  _id?: string;
  userId: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}
```

- [ ] **Step 3: Write src/shared/constants.ts**

```typescript
// ─── IPC Invoke Channels ───────────────────────────────
export const IPC = {
  AUTH_REGISTER: "auth:register",
  AUTH_LOGIN: "auth:login",
  AUTH_LOGOUT: "auth:logout",
  AUTH_SESSION: "auth:session",

  SETTINGS_SAVE_API_KEYS: "settings:save-api-keys",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",

  PORTFOLIO_GET: "portfolio:get",
  POSITIONS_GET: "positions:get",
  TRADES_HISTORY: "trades:history",

  AI_LAST_DECISION: "ai:last-decision",

  AGENT_START: "agent:start",
  AGENT_STOP: "agent:stop",
  AGENT_KILL_SWITCH: "agent:kill-switch",

  LOGS_RECENT: "logs:recent",
} as const;

// ─── IPC Stream Events ─────────────────────────────────
export const STREAM = {
  MARKET_TICK: "stream:market-tick",
  PORTFOLIO: "stream:portfolio",
  POSITIONS: "stream:positions",
  TRADE_EXECUTED: "stream:trade-executed",
  AI_DECISION: "stream:ai-decision",
  AGENT_STATUS: "stream:agent-status",
  LOG: "stream:log",
} as const;

// ─── Risk Defaults ─────────────────────────────────────
export const RISK_DEFAULTS = {
  maxRiskPct: 2,
  maxDailyLossPct: 5,
  maxOpenPositions: 3,
  minConfidence: 0.75,
  maxLeverage: 10,
} as const;

// ─── Trading Engine ────────────────────────────────────
export const ENGINE = {
  LOOP_INTERVAL_MS: 8000,
  PRICE_BUFFER_SIZE: 250,
  MIN_BARS_FOR_INDICATORS: 35,
  RSI_PERIOD: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  AI_TIMEOUT_MS: 30000,
  MAX_CONSECUTIVE_LOSSES: 3,
  MAX_DRAWDOWN_PCT: 15,
  WS_RECONNECT_RETRIES: 3,
  EXCHANGE_RETRY_COUNT: 3,
  VOLATILITY_THRESHOLD_PCT: 5,
  SPREAD_THRESHOLD_PCT: 0.5,
} as const;

// ─── Allowed IPC Channels (for preload whitelist) ──────
export const ALLOWED_INVOKE_CHANNELS = Object.values(IPC);
export const ALLOWED_STREAM_CHANNELS = Object.values(STREAM);
```

- [ ] **Step 4: Write src/shared/validators.ts**

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const apiKeysSchema = z.object({
  exchange: z.enum(["binance", "bybit"]),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export const settingsUpdateSchema = z.object({
  selectedExchange: z.enum(["binance", "bybit"]).optional(),
  tradingMode: z.enum(["spot", "futures"]).optional(),
  agentModeEnabled: z.boolean().optional(),
  themePreference: z.enum(["dark", "light"]).optional(),
  riskProfile: z
    .object({
      maxRiskPct: z.number().min(0.1).max(10).optional(),
      maxDailyLossPct: z.number().min(1).max(20).optional(),
      maxOpenPositions: z.number().int().min(1).max(20).optional(),
      minConfidence: z.number().min(0).max(1).optional(),
      maxLeverage: z.number().int().min(1).max(125).optional(),
    })
    .optional(),
});

export const aiDecisionSchema = z.object({
  decision: z.enum(["BUY", "SELL", "HOLD"]),
  confidence: z.number().min(0).max(1),
  entry: z.number().positive(),
  stop_loss: z.number().positive(),
  take_profit: z.number().positive(),
  reason: z.string().min(1),
});

export const agentStartSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit -p tsconfig.main.json
```
Expected: No errors (or only errors from missing src/main files, which is fine — shared compiles cleanly)

- [ ] **Step 6: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared types, IPC constants, and Zod validators"
```

---

## Phase 2: Database & Core Services

### Task 3: MongoDB Connection + Models

**Files:**
- Create: `src/db/mongoConnection.ts`
- Create: `src/db/models/User.ts`
- Create: `src/db/models/Trade.ts`
- Create: `src/db/models/Log.ts`

- [ ] **Step 1: Write src/db/mongoConnection.ts**

```typescript
import mongoose from "mongoose";

let connected = false;

export async function connectMongo(uri: string): Promise<void> {
  if (connected) return;
  await mongoose.connect(uri, { dbName: "trademax" });
  connected = true;
  console.log("[DB] Connected to MongoDB Atlas");
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log("[DB] Disconnected from MongoDB");
}
```

- [ ] **Step 2: Write src/db/models/User.ts**

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  exchangeKeys: {
    binance: { apiKey: string; apiSecret: string };
    bybit: { apiKey: string; apiSecret: string };
  };
  selectedExchange: "binance" | "bybit";
  tradingMode: "spot" | "futures";
  riskProfile: {
    maxRiskPct: number;
    maxDailyLossPct: number;
    maxOpenPositions: number;
    minConfidence: number;
    maxLeverage: number;
  };
  agentModeEnabled: boolean;
  themePreference: "dark" | "light";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    exchangeKeys: {
      binance: {
        apiKey: { type: String, default: "" },
        apiSecret: { type: String, default: "" },
      },
      bybit: {
        apiKey: { type: String, default: "" },
        apiSecret: { type: String, default: "" },
      },
    },
    selectedExchange: { type: String, enum: ["binance", "bybit"], default: "binance" },
    tradingMode: { type: String, enum: ["spot", "futures"], default: "spot" },
    riskProfile: {
      maxRiskPct: { type: Number, default: 2 },
      maxDailyLossPct: { type: Number, default: 5 },
      maxOpenPositions: { type: Number, default: 3 },
      minConfidence: { type: Number, default: 0.75 },
      maxLeverage: { type: Number, default: 10 },
    },
    agentModeEnabled: { type: Boolean, default: false },
    themePreference: { type: String, enum: ["dark", "light"], default: "dark" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
```

- [ ] **Step 3: Write src/db/models/Trade.ts**

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface ITrade extends Document {
  userId: mongoose.Types.ObjectId;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  pnl: number | null;
  status: "OPEN" | "CLOSED";
  source: "AI" | "MANUAL" | "SYSTEM";
  exchange: "binance" | "bybit";
  mode: "spot" | "futures";
  aiDecision: Record<string, unknown> | null;
  riskCheck: Record<string, unknown> | null;
  createdAt: Date;
  closedAt: Date | null;
}

const tradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true },
    side: { type: String, enum: ["BUY", "SELL"], required: true },
    type: { type: String, enum: ["MARKET", "LIMIT"], default: "MARKET" },
    entryPrice: { type: Number, required: true },
    exitPrice: { type: Number, default: null },
    quantity: { type: Number, required: true },
    pnl: { type: Number, default: null },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    source: { type: String, enum: ["AI", "MANUAL", "SYSTEM"], default: "AI" },
    exchange: { type: String, enum: ["binance", "bybit"], required: true },
    mode: { type: String, enum: ["spot", "futures"], required: true },
    aiDecision: { type: Schema.Types.Mixed, default: null },
    riskCheck: { type: Schema.Types.Mixed, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const TradeModel = mongoose.model<ITrade>("Trade", tradeSchema);
```

- [ ] **Step 4: Write src/db/models/Log.ts**

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface ILog extends Document {
  userId: mongoose.Types.ObjectId;
  level: "INFO" | "WARN" | "ERROR";
  category: "AUTH" | "TRADE" | "AI" | "RISK" | "SAFETY" | "SYSTEM";
  message: string;
  meta: Record<string, unknown>;
  timestamp: Date;
}

const logSchema = new Schema<ILog>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  level: { type: String, enum: ["INFO", "WARN", "ERROR"], required: true },
  category: { type: String, enum: ["AUTH", "TRADE", "AI", "RISK", "SAFETY", "SYSTEM"], required: true },
  message: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const LogModel = mongoose.model<ILog>("Log", logSchema);
```

- [ ] **Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: add MongoDB connection and Mongoose models (User, Trade, Log)"
```

---

### Task 4: Encryption Service

**Files:**
- Create: `src/services/encryptionService.ts`

- [ ] **Step 1: Write src/services/encryptionService.ts**

```typescript
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;

let derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (derivedKey) return derivedKey;

  const masterKey = process.env.APP_MASTER_KEY;
  if (!masterKey) throw new Error("APP_MASTER_KEY not set in environment");

  derivedKey = crypto.pbkdf2Sync(masterKey, "trademax-salt", PBKDF2_ITERATIONS, KEY_LENGTH, "sha512");
  return derivedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedString: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertext] = encryptedString.split(":");

  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted string format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/encryptionService.ts
git commit -m "feat: add AES-256-GCM encryption service with PBKDF2 key derivation"
```

---

### Task 5: Logger Service

**Files:**
- Create: `src/services/loggerService.ts`

- [ ] **Step 1: Write src/services/loggerService.ts**

```typescript
import { EventEmitter } from "node:events";
import { LogModel } from "../db/models/Log.js";
import type { LogLevel, LogCategory, LogEntry } from "../shared/types.js";

class LoggerService extends EventEmitter {
  private userId: string | null = null;

  setUserId(userId: string): void {
    this.userId = userId;
  }

  clearUserId(): void {
    this.userId = null;
  }

  async log(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    const entry: LogEntry = {
      userId: this.userId ?? "system",
      level,
      category,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    this.emit("log", entry);

    if (this.userId) {
      try {
        await LogModel.create({
          userId: this.userId,
          level,
          category,
          message,
          meta: meta ?? {},
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("[Logger] Failed to persist log:", err);
      }
    }
  }

  info(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("INFO", category, message, meta);
  }

  warn(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("WARN", category, message, meta);
  }

  error(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("ERROR", category, message, meta);
  }
}

export const logger = new LoggerService();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/loggerService.ts
git commit -m "feat: add EventEmitter-based logger with MongoDB persistence"
```

---

### Task 6: Auth Service + Session Manager

**Files:**
- Create: `src/services/authService.ts`
- Create: `src/main/sessionManager.ts`

- [ ] **Step 1: Write src/services/authService.ts**

```typescript
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
```

- [ ] **Step 2: Write src/main/sessionManager.ts**

```typescript
import Store from "electron-store";

interface SessionData {
  token: string;
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}

const store = new Store<{ session: SessionData | null }>({
  name: "trademax-session",
  defaults: { session: null },
});

export function saveSession(token: string): void {
  const existing = store.get("session");
  store.set("session", {
    token,
    frozen: existing?.frozen ?? false,
    frozenReason: existing?.frozenReason ?? null,
    consecutiveLosses: existing?.consecutiveLosses ?? 0,
    peakBalance: existing?.peakBalance ?? 0,
    emergencyShutdown: existing?.emergencyShutdown ?? false,
  });
}

export function getToken(): string | null {
  return store.get("session")?.token ?? null;
}

export function clearSession(): void {
  store.delete("session");
}

export function saveSafetyState(state: {
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}): void {
  const existing = store.get("session");
  if (!existing) return;
  store.set("session", { ...existing, ...state });
}

export function getSafetyState(): {
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
} {
  const session = store.get("session");
  return {
    frozen: session?.frozen ?? false,
    frozenReason: session?.frozenReason ?? null,
    consecutiveLosses: session?.consecutiveLosses ?? 0,
    peakBalance: session?.peakBalance ?? 0,
    emergencyShutdown: session?.emergencyShutdown ?? false,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/authService.ts src/main/sessionManager.ts
git commit -m "feat: add auth service (bcrypt+JWT) and electron-store session manager"
```

---

### Task 7: Safety Service

**Files:**
- Create: `src/services/safetyService.ts`

- [ ] **Step 1: Write src/services/safetyService.ts**

```typescript
import { logger } from "./loggerService.js";
import { saveSafetyState, getSafetyState } from "../main/sessionManager.js";
import { ENGINE } from "../shared/constants.js";
import type { SafetyState } from "../shared/types.js";

class SafetyService {
  private state: SafetyState;

  constructor() {
    const persisted = getSafetyState();
    this.state = {
      frozen: persisted.frozen,
      frozenReason: persisted.frozenReason as SafetyState["frozenReason"],
      consecutiveLosses: persisted.consecutiveLosses,
      peakBalance: persisted.peakBalance,
      emergencyShutdown: persisted.emergencyShutdown,
    };
  }

  getState(): SafetyState {
    return { ...this.state };
  }

  canTrade(): boolean {
    return !this.state.frozen && !this.state.emergencyShutdown;
  }

  recordWin(): void {
    this.state.consecutiveLosses = 0;
    this.persist();
  }

  recordLoss(): void {
    this.state.consecutiveLosses += 1;

    if (this.state.consecutiveLosses >= ENGINE.MAX_CONSECUTIVE_LOSSES) {
      this.freeze("CONSECUTIVE_LOSSES");
      logger.warn("SAFETY", `Agent frozen: ${ENGINE.MAX_CONSECUTIVE_LOSSES} consecutive losses`, {
        consecutiveLosses: this.state.consecutiveLosses,
      });
    }

    this.persist();
  }

  updatePeakBalance(currentBalance: number): void {
    if (currentBalance > this.state.peakBalance) {
      this.state.peakBalance = currentBalance;
      this.persist();
    }
  }

  checkDrawdown(currentBalance: number): boolean {
    if (this.state.peakBalance <= 0) return true;

    const drawdownPct = ((this.state.peakBalance - currentBalance) / this.state.peakBalance) * 100;
    if (drawdownPct >= ENGINE.MAX_DRAWDOWN_PCT) {
      this.freeze("DRAWDOWN");
      logger.error("SAFETY", `Agent frozen: drawdown ${drawdownPct.toFixed(1)}% exceeds ${ENGINE.MAX_DRAWDOWN_PCT}%`, {
        peakBalance: this.state.peakBalance,
        currentBalance,
        drawdownPct,
      });
      return false;
    }
    return true;
  }

  reportApiFailure(): void {
    this.freeze("API_FAILURE");
    logger.error("SAFETY", "Agent frozen: exchange API failure threshold reached");
  }

  freeze(reason: SafetyState["frozenReason"]): void {
    this.state.frozen = true;
    this.state.frozenReason = reason;
    this.persist();
  }

  activateKillSwitch(): void {
    this.state.frozen = true;
    this.state.frozenReason = "KILL_SWITCH";
    this.state.emergencyShutdown = true;
    this.persist();
    logger.error("SAFETY", "KILL SWITCH ACTIVATED — all trading halted");
  }

  resetFreeze(): void {
    this.state.frozen = false;
    this.state.frozenReason = null;
    this.state.consecutiveLosses = 0;
    this.state.emergencyShutdown = false;
    this.persist();
    logger.info("SAFETY", "Safety freeze cleared — agent can be re-enabled");
  }

  private persist(): void {
    saveSafetyState({
      frozen: this.state.frozen,
      frozenReason: this.state.frozenReason,
      consecutiveLosses: this.state.consecutiveLosses,
      peakBalance: this.state.peakBalance,
      emergencyShutdown: this.state.emergencyShutdown,
    });
  }
}

export const safetyService = new SafetyService();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/safetyService.ts
git commit -m "feat: add safety service with freeze, kill switch, and drawdown detection"
```

---

### Task 8: Risk Engine

**Files:**
- Create: `src/services/riskEngine.ts`

- [ ] **Step 1: Write src/services/riskEngine.ts**

```typescript
import { ENGINE } from "../shared/constants.js";
import type { RiskResult, RiskContext } from "../shared/types.js";

interface RuleCheck {
  name: string;
  check: (ctx: RiskContext) => { pass: boolean; reason: string };
}

const rules: RuleCheck[] = [
  {
    name: "MAX_RISK_PER_TRADE",
    check: (ctx) => {
      const riskAmount = ctx.portfolio.totalBalance * (ctx.riskProfile.maxRiskPct / 100);
      const tradeRisk = Math.abs(ctx.decision.entry - ctx.decision.stop_loss);
      if (tradeRisk <= 0) return { pass: false, reason: "Stop loss distance is zero or negative" };
      const maxQuantity = riskAmount / tradeRisk;
      return {
        pass: true,
        reason: `Max position size: ${maxQuantity.toFixed(6)} units (risk $${riskAmount.toFixed(2)})`,
      };
    },
  },
  {
    name: "MAX_DAILY_LOSS",
    check: (ctx) => {
      const maxLoss = ctx.portfolio.totalBalance * (ctx.riskProfile.maxDailyLossPct / 100);
      const pass = ctx.dailyRealizedLoss < maxLoss;
      return {
        pass,
        reason: pass
          ? `Daily loss $${ctx.dailyRealizedLoss.toFixed(2)} < limit $${maxLoss.toFixed(2)}`
          : `Daily loss $${ctx.dailyRealizedLoss.toFixed(2)} exceeds limit $${maxLoss.toFixed(2)}`,
      };
    },
  },
  {
    name: "MAX_OPEN_POSITIONS",
    check: (ctx) => {
      const pass = ctx.openTradeCount < ctx.riskProfile.maxOpenPositions;
      return {
        pass,
        reason: pass
          ? `${ctx.openTradeCount} open < max ${ctx.riskProfile.maxOpenPositions}`
          : `${ctx.openTradeCount} open positions >= max ${ctx.riskProfile.maxOpenPositions}`,
      };
    },
  },
  {
    name: "MIN_CONFIDENCE",
    check: (ctx) => {
      const pass = ctx.decision.confidence >= ctx.riskProfile.minConfidence;
      return {
        pass,
        reason: pass
          ? `Confidence ${ctx.decision.confidence} >= threshold ${ctx.riskProfile.minConfidence}`
          : `Confidence ${ctx.decision.confidence} < threshold ${ctx.riskProfile.minConfidence}`,
      };
    },
  },
  {
    name: "VOLATILITY_FILTER",
    check: (ctx) => {
      const pass = Math.abs(ctx.priceChange1h) < ENGINE.VOLATILITY_THRESHOLD_PCT;
      return {
        pass,
        reason: pass
          ? `1h price change ${ctx.priceChange1h.toFixed(2)}% within threshold`
          : `1h price change ${ctx.priceChange1h.toFixed(2)}% exceeds ${ENGINE.VOLATILITY_THRESHOLD_PCT}% threshold`,
      };
    },
  },
  {
    name: "SPREAD_FILTER",
    check: (ctx) => {
      const pass = ctx.spread < ENGINE.SPREAD_THRESHOLD_PCT;
      return {
        pass,
        reason: pass
          ? `Spread ${ctx.spread.toFixed(3)}% within threshold`
          : `Spread ${ctx.spread.toFixed(3)}% exceeds ${ENGINE.SPREAD_THRESHOLD_PCT}% threshold`,
      };
    },
  },
  {
    name: "MAX_LEVERAGE",
    check: (ctx) => {
      if (ctx.tradingMode !== "futures") return { pass: true, reason: "Spot mode — leverage check skipped" };
      const pass = ctx.riskProfile.maxLeverage <= 125;
      return {
        pass,
        reason: pass
          ? `Leverage ${ctx.riskProfile.maxLeverage}x within limit`
          : `Leverage ${ctx.riskProfile.maxLeverage}x exceeds maximum`,
      };
    },
  },
  {
    name: "MAX_DRAWDOWN",
    check: (ctx) => {
      if (ctx.peakBalance <= 0) return { pass: true, reason: "No peak balance recorded yet" };
      const drawdownPct = ((ctx.peakBalance - ctx.portfolio.totalBalance) / ctx.peakBalance) * 100;
      const pass = drawdownPct < ENGINE.MAX_DRAWDOWN_PCT;
      return {
        pass,
        reason: pass
          ? `Drawdown ${drawdownPct.toFixed(1)}% < ${ENGINE.MAX_DRAWDOWN_PCT}% limit`
          : `Drawdown ${drawdownPct.toFixed(1)}% exceeds ${ENGINE.MAX_DRAWDOWN_PCT}% limit`,
      };
    },
  },
];

export function validateTrade(ctx: RiskContext): RiskResult {
  const passed: string[] = [];
  const failed: string[] = [];
  const reasons: string[] = [];

  for (const rule of rules) {
    const result = rule.check(ctx);
    if (result.pass) {
      passed.push(rule.name);
    } else {
      failed.push(rule.name);
      reasons.push(result.reason);
    }
  }

  return {
    approved: failed.length === 0,
    passed,
    failed,
    reasons,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/riskEngine.ts
git commit -m "feat: add risk engine with 8 guardrails for trade validation"
```

---

### Task 9: AI Service (Claude Integration)

**Files:**
- Create: `src/services/aiService.ts`

- [ ] **Step 1: Write src/services/aiService.ts**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { aiDecisionSchema } from "../shared/validators.js";
import { logger } from "./loggerService.js";
import { ENGINE } from "../shared/constants.js";
import type { AIDecision, AIPromptData } from "../shared/types.js";

const SYSTEM_PROMPT = `You are a quantitative crypto trading analyst. Analyze the provided market data and return a strict JSON trading decision. You are advisory only — your output will be validated by a risk engine before any execution. Never recommend risking more than the user's configured risk profile allows.

You MUST respond with ONLY a JSON object in this exact format:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": <number between 0 and 1>,
  "entry": <positive number>,
  "stop_loss": <positive number>,
  "take_profit": <positive number>,
  "reason": "<short explanation>"
}

No markdown, no code blocks, no extra text. Only the raw JSON object.`;

const HOLD_FALLBACK: AIDecision = {
  decision: "HOLD",
  confidence: 0,
  entry: 0,
  stop_loss: 0,
  take_profit: 0,
  reason: "AI fallback — unable to generate decision",
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY not set in environment");
  client = new Anthropic({ apiKey });
  return client;
}

export async function getAIDecision(data: AIPromptData): Promise<AIDecision> {
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(data, null, 2),
        },
      ],
    });

    const text = response.content[0];
    if (text.type !== "text") {
      await logger.warn("AI", "AI response was not text", { contentType: text.type });
      return HOLD_FALLBACK;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      await logger.error("AI", "AI_PARSE_ERROR: Failed to parse AI response as JSON", {
        rawResponse: text.text.substring(0, 500),
      });
      return HOLD_FALLBACK;
    }

    const validated = aiDecisionSchema.safeParse(parsed);
    if (!validated.success) {
      await logger.error("AI", "AI_VALIDATION_ERROR: AI response failed Zod validation", {
        errors: validated.error.issues,
        rawResponse: text.text.substring(0, 500),
      });
      return HOLD_FALLBACK;
    }

    return validated.data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    const isTimeout = message.includes("timeout") || message.includes("ETIMEDOUT");

    await logger.error("AI", isTimeout ? "AI_TIMEOUT" : "AI_API_ERROR", {
      error: message,
    });

    return HOLD_FALLBACK;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/aiService.ts
git commit -m "feat: add Claude AI service with strict JSON validation and fallback"
```

---

### Task 10: Exchange Services (Binance + Bybit + Factory)

**Files:**
- Create: `src/services/binanceService.ts`
- Create: `src/services/bybitService.ts`
- Create: `src/services/exchangeFactory.ts`

- [ ] **Step 1: Write src/services/binanceService.ts**

```typescript
import axios, { type AxiosInstance } from "axios";
import crypto from "node:crypto";
import WebSocket from "ws";
import { logger } from "./loggerService.js";
import { ENGINE } from "../shared/constants.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

const SPOT_BASE = "https://api.binance.com";
const FUTURES_BASE = "https://fapi.binance.com";

export class BinanceService {
  private apiKey = "";
  private apiSecret = "";
  private spot: AxiosInstance;
  private futures: AxiosInstance;
  private ws: WebSocket | null = null;
  private mode: "spot" | "futures" = "spot";
  private reconnectAttempts = 0;

  constructor() {
    this.spot = axios.create({ baseURL: SPOT_BASE });
    this.futures = axios.create({ baseURL: FUTURES_BASE });
  }

  async initialize(keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    this.apiKey = keys.apiKey;
    this.apiSecret = keys.apiSecret;
    this.mode = mode;
    this.reconnectAttempts = 0;
  }

  destroy(): void {
    this.stopTickerStream();
    this.apiKey = "";
    this.apiSecret = "";
  }

  private sign(params: Record<string, string | number>): string {
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = crypto.createHmac("sha256", this.apiSecret).update(query).digest("hex");
    return `${query}&signature=${signature}`;
  }

  private async signedGet(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.get(`${path}?${query}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedPost(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.post(`${path}?${query}`, null, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  private async signedDelete(client: AxiosInstance, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    const query = this.sign(allParams);
    const { data } = await client.delete(`${path}?${query}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return data;
  }

  async getBalance(): Promise<PortfolioSnapshot> {
    if (this.mode === "spot") {
      const data = (await this.signedGet(this.spot, "/api/v3/account")) as {
        balances: Array<{ asset: string; free: string; locked: string }>;
      };
      let total = 0;
      for (const b of data.balances) {
        const free = parseFloat(b.free);
        const locked = parseFloat(b.locked);
        if (b.asset === "USDT") total += free + locked;
      }
      return { totalBalance: total, availableBalance: total, dailyPnl: 0, weeklyPnl: 0 };
    }

    const data = (await this.signedGet(this.futures, "/fapi/v2/balance")) as Array<{
      asset: string;
      balance: string;
      availableBalance: string;
    }>;
    const usdt = data.find((b) => b.asset === "USDT");
    return {
      totalBalance: usdt ? parseFloat(usdt.balance) : 0,
      availableBalance: usdt ? parseFloat(usdt.availableBalance) : 0,
      dailyPnl: 0,
      weeklyPnl: 0,
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    if (this.mode === "spot") return [];

    const data = (await this.signedGet(this.futures, "/fapi/v2/positionRisk")) as Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
      unRealizedProfit: string;
      liquidationPrice: string;
    }>;

    return data
      .filter((p) => parseFloat(p.positionAmt) !== 0)
      .map((p) => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? ("BUY" as const) : ("SELL" as const),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        quantity: Math.abs(parseFloat(p.positionAmt)),
        unrealizedPnl: parseFloat(p.unRealizedProfit),
        liquidationPrice: parseFloat(p.liquidationPrice) || null,
      }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const client = this.mode === "spot" ? this.spot : this.futures;
    const path = this.mode === "spot" ? "/api/v3/order" : "/fapi/v1/order";

    const data = (await this.signedPost(client, path, {
      symbol,
      side,
      type: "MARKET",
      quantity: quantity.toString(),
    })) as { orderId: number; symbol: string; side: string; executedQty: string; avgPrice?: string; price?: string; status: string };

    return {
      orderId: data.orderId.toString(),
      symbol: data.symbol,
      side: data.side as "BUY" | "SELL",
      quantity: parseFloat(data.executedQty),
      price: parseFloat(data.avgPrice ?? data.price ?? "0"),
      status: data.status,
    };
  }

  async closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const closeSide = side === "BUY" ? "SELL" : "BUY";
    return this.placeMarketOrder(symbol, closeSide, quantity);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (this.mode === "spot") {
      if (symbol) {
        await this.signedDelete(this.spot, "/api/v3/openOrders", { symbol });
      }
    } else {
      if (symbol) {
        await this.signedDelete(this.futures, "/fapi/v1/allOpenOrders", { symbol });
      }
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.mode !== "futures") return;
    await this.signedPost(this.futures, "/fapi/v1/leverage", { symbol, leverage });
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void): void {
    this.stopTickerStream();
    const wsSymbol = symbol.toLowerCase();
    const baseUrl = this.mode === "spot" ? "wss://stream.binance.com:9443/ws" : "wss://fstream.binance.com/ws";
    const url = `${baseUrl}/${wsSymbol}@ticker`;

    this.connectWebSocket(url, symbol, callback);
  }

  private connectWebSocket(url: string, symbol: string, callback: (tick: MarketTick) => void): void {
    this.ws = new WebSocket(url);

    this.ws.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as { c: string; E: number };
        callback({ symbol, price: parseFloat(data.c), timestamp: data.E });
        this.reconnectAttempts = 0;
      } catch {
        /* ignore malformed messages */
      }
    });

    this.ws.on("close", () => {
      if (this.reconnectAttempts < ENGINE.WS_RECONNECT_RETRIES) {
        this.reconnectAttempts++;
        const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
        logger.warn("SYSTEM", `Binance WebSocket closed, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connectWebSocket(url, symbol, callback), delay);
      } else {
        logger.error("SYSTEM", "Binance WebSocket failed after max retries");
      }
    });

    this.ws.on("error", (err: Error) => {
      logger.error("SYSTEM", `Binance WebSocket error: ${err.message}`);
    });
  }

  stopTickerStream(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = ENGINE.WS_RECONNECT_RETRIES;
  }
}
```

- [ ] **Step 2: Write src/services/bybitService.ts**

```typescript
import { RestClientV5, WebsocketClient } from "bybit-api";
import { logger } from "./loggerService.js";
import { ENGINE } from "../shared/constants.js";
import type { PortfolioSnapshot, Position, OrderResult, MarketTick, ExchangeKeys } from "../shared/types.js";

export class BybitService {
  private rest: RestClientV5 | null = null;
  private wsClient: WebsocketClient | null = null;
  private mode: "spot" | "futures" = "spot";
  private apiKey = "";
  private apiSecret = "";

  async initialize(keys: ExchangeKeys, mode: "spot" | "futures"): Promise<void> {
    this.apiKey = keys.apiKey;
    this.apiSecret = keys.apiSecret;
    this.mode = mode;

    this.rest = new RestClientV5({ key: this.apiKey, secret: this.apiSecret });
  }

  destroy(): void {
    this.stopTickerStream();
    this.rest = null;
    this.apiKey = "";
    this.apiSecret = "";
  }

  private getCategory(): "spot" | "linear" {
    return this.mode === "spot" ? "spot" : "linear";
  }

  async getBalance(): Promise<PortfolioSnapshot> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const { result } = await this.rest.getWalletBalance({ accountType: "UNIFIED" });
    const account = result.list?.[0];
    if (!account) return { totalBalance: 0, availableBalance: 0, dailyPnl: 0, weeklyPnl: 0 };

    return {
      totalBalance: parseFloat(account.totalEquity ?? "0"),
      availableBalance: parseFloat(account.totalAvailableBalance ?? "0"),
      dailyPnl: 0,
      weeklyPnl: 0,
    };
  }

  async getOpenPositions(): Promise<Position[]> {
    if (!this.rest) throw new Error("Bybit not initialized");
    if (this.mode === "spot") return [];

    const { result } = await this.rest.getPositionInfo({
      category: "linear",
      settleCoin: "USDT",
    });

    return (result.list ?? [])
      .filter((p) => parseFloat(p.size) > 0)
      .map((p) => ({
        symbol: p.symbol,
        side: p.side === "Buy" ? ("BUY" as const) : ("SELL" as const),
        entryPrice: parseFloat(p.avgPrice),
        markPrice: parseFloat(p.markPrice),
        quantity: parseFloat(p.size),
        unrealizedPnl: parseFloat(p.unrealisedPnl),
        liquidationPrice: parseFloat(p.liqPrice) || null,
      }));
  }

  async placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    if (!this.rest) throw new Error("Bybit not initialized");

    const { result } = await this.rest.submitOrder({
      category: this.getCategory(),
      symbol,
      side: side === "BUY" ? "Buy" : "Sell",
      orderType: "Market",
      qty: quantity.toString(),
    });

    return {
      orderId: result.orderId,
      symbol,
      side,
      quantity,
      price: 0, // market order — filled price comes from fills
      status: "FILLED",
    };
  }

  async closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult> {
    const closeSide = side === "BUY" ? "SELL" : "BUY";
    return this.placeMarketOrder(symbol, closeSide, quantity);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    if (!this.rest) throw new Error("Bybit not initialized");

    await this.rest.cancelAllOrders({
      category: this.getCategory(),
      ...(symbol ? { symbol } : {}),
    });
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    if (!this.rest || this.mode !== "futures") return;

    try {
      await this.rest.setLeverage({
        category: "linear",
        symbol,
        buyLeverage: leverage.toString(),
        sellLeverage: leverage.toString(),
      });
    } catch (err: unknown) {
      // Bybit throws if leverage is already set to the same value — safe to ignore
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("leverage not modified")) throw err;
    }
  }

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void): void {
    this.stopTickerStream();

    this.wsClient = new WebsocketClient({
      market: this.mode === "spot" ? "v5" : "v5",
      key: this.apiKey,
      secret: this.apiSecret,
    });

    const topic = `tickers.${symbol}`;
    this.wsClient.subscribeV5(topic, this.mode === "spot" ? "spot" : "linear");

    this.wsClient.on("update", (msg: { topic: string; data: { lastPrice: string } }) => {
      if (msg.topic === topic) {
        callback({
          symbol,
          price: parseFloat(msg.data.lastPrice),
          timestamp: Date.now(),
        });
      }
    });

    this.wsClient.on("error", (err: Error) => {
      logger.error("SYSTEM", `Bybit WebSocket error: ${err.message}`);
    });
  }

  stopTickerStream(): void {
    if (this.wsClient) {
      try {
        this.wsClient.closeAll();
      } catch {
        /* ignore cleanup errors */
      }
      this.wsClient = null;
    }
  }
}
```

- [ ] **Step 3: Write src/services/exchangeFactory.ts**

```typescript
import { BinanceService } from "./binanceService.js";
import { BybitService } from "./bybitService.js";

export type ExchangeServiceInstance = BinanceService | BybitService;

export function createExchangeService(exchange: "binance" | "bybit"): ExchangeServiceInstance {
  if (exchange === "binance") return new BinanceService();
  return new BybitService();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/services/binanceService.ts src/services/bybitService.ts src/services/exchangeFactory.ts
git commit -m "feat: add Binance and Bybit exchange services with unified interface + factory"
```

---

### Task 11: Trade Engine

**Files:**
- Create: `src/services/tradeEngine.ts`

- [ ] **Step 1: Write src/services/tradeEngine.ts**

```typescript
import { RSI, MACD } from "technicalindicators";
import { createExchangeService, type ExchangeServiceInstance } from "./exchangeFactory.js";
import { getAIDecision } from "./aiService.js";
import { validateTrade } from "./riskEngine.js";
import { safetyService } from "./safetyService.js";
import { logger } from "./loggerService.js";
import { decrypt } from "./encryptionService.js";
import { getUserDoc } from "./authService.js";
import { TradeModel } from "../db/models/Trade.js";
import { ENGINE } from "../shared/constants.js";
import type {
  PriceBar,
  AIDecision,
  AgentStatus,
  PortfolioSnapshot,
  Position,
  MarketTick,
  Trade,
  AIPromptData,
} from "../shared/types.js";

type StreamCallback = {
  onMarketTick?: (tick: MarketTick) => void;
  onPortfolio?: (snap: PortfolioSnapshot) => void;
  onPositions?: (positions: Position[]) => void;
  onTradeExecuted?: (trade: Trade) => void;
  onAIDecision?: (decision: AIDecision) => void;
  onAgentStatus?: (status: AgentStatus) => void;
};

export class TradeEngine {
  private userId: string = "";
  private symbol: string = "";
  private exchange: ExchangeServiceInstance | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private priceBuffer: PriceBar[] = [];
  private running = false;
  private lastAIDecision: AIDecision | null = null;
  private callbacks: StreamCallback = {};
  private apiFailures = 0;

  setCallbacks(cb: StreamCallback): void {
    this.callbacks = cb;
  }

  getLastAIDecision(): AIDecision | null {
    return this.lastAIDecision;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): AgentStatus {
    const safety = safetyService.getState();
    return {
      running: this.running,
      frozen: safety.frozen,
      reason: safety.frozenReason ?? undefined,
    };
  }

  async start(userId: string, symbol: string): Promise<void> {
    if (this.running) return;

    const user = await getUserDoc(userId);
    this.userId = userId;
    this.symbol = symbol.toUpperCase();
    this.priceBuffer = [];
    this.apiFailures = 0;

    const selectedExchange = user.selectedExchange;
    const keys = user.exchangeKeys[selectedExchange];
    if (!keys.apiKey || !keys.apiSecret) {
      throw new Error(`No API keys configured for ${selectedExchange}`);
    }

    const decryptedKey = decrypt(keys.apiKey);
    const decryptedSecret = decrypt(keys.apiSecret);

    this.exchange = createExchangeService(selectedExchange);
    await this.exchange.initialize({ apiKey: decryptedKey, apiSecret: decryptedSecret }, user.tradingMode);

    this.exchange.startTickerStream(this.symbol, (tick) => {
      this.priceBuffer.push({ price: tick.price, timestamp: tick.timestamp });
      if (this.priceBuffer.length > ENGINE.PRICE_BUFFER_SIZE) {
        this.priceBuffer.shift();
      }
      this.callbacks.onMarketTick?.(tick);
    });

    this.running = true;
    this.emitStatus();
    await logger.info("TRADE", `Agent started on ${this.symbol} (${selectedExchange} ${user.tradingMode})`);

    this.loopTimer = setInterval(() => this.cycle(), ENGINE.LOOP_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = null;

    this.exchange?.stopTickerStream();
    this.exchange?.destroy();
    this.exchange = null;

    this.running = false;
    this.emitStatus();
    await logger.info("TRADE", "Agent stopped");
  }

  async killSwitch(): Promise<void> {
    await logger.error("SAFETY", "KILL SWITCH — executing emergency shutdown");

    if (this.exchange) {
      try {
        await this.exchange.cancelAllOrders(this.symbol);
      } catch (err) {
        await logger.error("SAFETY", `Kill switch: cancel orders failed: ${err}`);
      }

      try {
        const positions = await this.exchange.getOpenPositions();
        for (const pos of positions) {
          await this.exchange.closePosition(pos.symbol, pos.side, pos.quantity);
          await logger.info("SAFETY", `Kill switch: closed ${pos.symbol} ${pos.side} ${pos.quantity}`);
        }
      } catch (err) {
        await logger.error("SAFETY", `Kill switch: close positions failed: ${err}`);
      }
    }

    safetyService.activateKillSwitch();
    await this.stop();
  }

  private async cycle(): Promise<void> {
    if (!this.exchange || !this.running) return;

    try {
      // [1] Safety gates
      if (!safetyService.canTrade()) {
        await logger.warn("SAFETY", "Cycle skipped — agent is frozen");
        return;
      }

      // [2] Check indicators ready
      if (this.priceBuffer.length < ENGINE.MIN_BARS_FOR_INDICATORS) {
        return; // silently wait for more data
      }

      const prices = this.priceBuffer.map((b) => b.price);
      const currentPrice = prices[prices.length - 1];

      const rsiValues = RSI.calculate({ values: prices, period: ENGINE.RSI_PERIOD });
      const rsi = rsiValues[rsiValues.length - 1] ?? 50;

      const macdResult = MACD.calculate({
        values: prices,
        fastPeriod: ENGINE.MACD_FAST,
        slowPeriod: ENGINE.MACD_SLOW,
        signalPeriod: ENGINE.MACD_SIGNAL,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const macd = macdResult[macdResult.length - 1] ?? { MACD: 0, signal: 0, histogram: 0 };

      // [3] Portfolio
      let portfolio: PortfolioSnapshot;
      try {
        portfolio = await this.exchange.getBalance();
        this.apiFailures = 0;
      } catch (err) {
        this.apiFailures++;
        if (this.apiFailures >= ENGINE.EXCHANGE_RETRY_COUNT) {
          safetyService.reportApiFailure();
          this.emitStatus();
        }
        await logger.error("TRADE", `Exchange balance fetch failed (attempt ${this.apiFailures}): ${err}`);
        return;
      }

      safetyService.updatePeakBalance(portfolio.totalBalance);
      if (!safetyService.checkDrawdown(portfolio.totalBalance)) {
        this.emitStatus();
        return;
      }

      // Compute daily PnL from closed trades today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todaysTrades = await TradeModel.find({
        userId: this.userId,
        status: "CLOSED",
        closedAt: { $gte: todayStart },
      });
      const dailyPnl = todaysTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      portfolio.dailyPnl = dailyPnl;

      this.callbacks.onPortfolio?.(portfolio);

      // [4] Open positions
      let positions: Position[];
      try {
        positions = await this.exchange.getOpenPositions();
      } catch (err) {
        await logger.error("TRADE", `Position fetch failed: ${err}`);
        return;
      }

      this.callbacks.onPositions?.(positions);

      // [5] Check SL/TP on open trades
      const openTrades = await TradeModel.find({ userId: this.userId, status: "OPEN" });
      for (const trade of openTrades) {
        if (!trade.aiDecision) continue;
        const ai = trade.aiDecision as { stop_loss: number; take_profit: number };

        const hitSL =
          trade.side === "BUY" ? currentPrice <= ai.stop_loss : currentPrice >= ai.stop_loss;
        const hitTP =
          trade.side === "BUY" ? currentPrice >= ai.take_profit : currentPrice <= ai.take_profit;

        if (hitSL || hitTP) {
          try {
            await this.exchange.closePosition(trade.symbol, trade.side as "BUY" | "SELL", trade.quantity);
            const pnl =
              trade.side === "BUY"
                ? (currentPrice - trade.entryPrice) * trade.quantity
                : (trade.entryPrice - currentPrice) * trade.quantity;

            trade.exitPrice = currentPrice;
            trade.pnl = pnl;
            trade.status = "CLOSED";
            trade.closedAt = new Date();
            await trade.save();

            if (pnl >= 0) safetyService.recordWin();
            else safetyService.recordLoss();

            const reason = hitSL ? "STOP_LOSS" : "TAKE_PROFIT";
            await logger.info("TRADE", `Position closed via ${reason}: ${trade.symbol} PnL: ${pnl.toFixed(2)}`);

            this.callbacks.onTradeExecuted?.({
              _id: trade._id.toString(),
              userId: trade.userId.toString(),
              symbol: trade.symbol,
              side: trade.side as "BUY" | "SELL",
              type: trade.type as "MARKET" | "LIMIT",
              entryPrice: trade.entryPrice,
              exitPrice: currentPrice,
              quantity: trade.quantity,
              pnl,
              status: "CLOSED",
              source: trade.source as "AI" | "MANUAL" | "SYSTEM",
              exchange: trade.exchange as "binance" | "bybit",
              mode: trade.mode as "spot" | "futures",
              aiDecision: trade.aiDecision as AIDecision | null,
              riskCheck: trade.riskCheck as Trade["riskCheck"],
              createdAt: trade.createdAt.toISOString(),
              closedAt: new Date().toISOString(),
            });
          } catch (err) {
            await logger.error("TRADE", `Failed to close position: ${err}`);
          }
        }
      }

      // [6] AI decision
      const user = await getUserDoc(this.userId);
      const openTradeCount = await TradeModel.countDocuments({ userId: this.userId, status: "OPEN" });

      const promptData: AIPromptData = {
        symbol: this.symbol,
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        currentPrice,
        indicators: {
          rsi,
          macd: {
            line: macd.MACD ?? 0,
            signal: macd.signal ?? 0,
            histogram: macd.histogram ?? 0,
          },
        },
        portfolio,
        openPositions: positions,
        riskProfile: user.riskProfile,
      };

      const decision = await getAIDecision(promptData);
      this.lastAIDecision = decision;
      this.callbacks.onAIDecision?.(decision);
      await logger.info("AI", `Decision: ${decision.decision} (confidence: ${decision.confidence})`, { decision });

      // [7] HOLD → skip
      if (decision.decision === "HOLD") return;

      // [8] Risk check
      const priceChange1h =
        this.priceBuffer.length > 1
          ? ((currentPrice - this.priceBuffer[0].price) / this.priceBuffer[0].price) * 100
          : 0;

      const dailyRealizedLoss = Math.abs(Math.min(0, dailyPnl));

      const riskResult = validateTrade({
        decision,
        portfolio,
        openTradeCount,
        dailyRealizedLoss,
        priceChange1h,
        spread: 0.1, // placeholder — real spread from order book would be better
        peakBalance: safetyService.getState().peakBalance,
        riskProfile: user.riskProfile,
        tradingMode: user.tradingMode,
      });

      if (!riskResult.approved) {
        await logger.warn("RISK", `Trade rejected: ${riskResult.reasons.join(", ")}`, { riskResult });
        return;
      }

      // [10] Position size
      const riskAmount = portfolio.totalBalance * (user.riskProfile.maxRiskPct / 100);
      const slDistance = Math.abs(decision.entry - decision.stop_loss);
      if (slDistance <= 0) return;
      const quantity = parseFloat((riskAmount / slDistance).toFixed(6));

      // [11] Leverage (futures)
      if (user.tradingMode === "futures") {
        await this.exchange.setLeverage(this.symbol, user.riskProfile.maxLeverage);
      }

      // [12] Execute
      const orderResult = await this.exchange.placeMarketOrder(this.symbol, decision.decision as "BUY" | "SELL", quantity);

      // [13] Record trade
      const tradeDoc = await TradeModel.create({
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision,
        type: "MARKET",
        entryPrice: orderResult.price || decision.entry,
        quantity: orderResult.quantity || quantity,
        status: "OPEN",
        source: "AI",
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        aiDecision: decision,
        riskCheck: riskResult,
      });

      await logger.info("TRADE", `Order executed: ${decision.decision} ${this.symbol} qty=${quantity}`, {
        orderId: orderResult.orderId,
        decision,
        riskResult,
      });

      // [14] Emit
      this.callbacks.onTradeExecuted?.({
        _id: tradeDoc._id.toString(),
        userId: this.userId,
        symbol: this.symbol,
        side: decision.decision as "BUY" | "SELL",
        type: "MARKET",
        entryPrice: orderResult.price || decision.entry,
        exitPrice: null,
        quantity: orderResult.quantity || quantity,
        pnl: null,
        status: "OPEN",
        source: "AI",
        exchange: user.selectedExchange,
        mode: user.tradingMode,
        aiDecision: decision,
        riskCheck: riskResult,
        createdAt: tradeDoc.createdAt.toISOString(),
        closedAt: null,
      });
    } catch (err) {
      await logger.error("TRADE", `Cycle error: ${err}`);
    }
  }

  private emitStatus(): void {
    this.callbacks.onAgentStatus?.(this.getStatus());
  }
}

export const tradeEngine = new TradeEngine();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/tradeEngine.ts
git commit -m "feat: add trade engine with full AI→risk→execute pipeline and SL/TP monitoring"
```

---

## Phase 3: Electron Shell (Main + Preload + IPC)

### Task 12: Preload Bridge

**Files:**
- Create: `src/preload/index.ts`

- [ ] **Step 1: Write src/preload/index.ts**

```typescript
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { ALLOWED_INVOKE_CHANNELS, ALLOWED_STREAM_CHANNELS } from "../shared/constants.js";

contextBridge.exposeInMainWorld("api", {
  invoke(channel: string, data?: unknown): Promise<unknown> {
    if (!ALLOWED_INVOKE_CHANNELS.includes(channel as typeof ALLOWED_INVOKE_CHANNELS[number])) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, data);
  },

  on(event: string, callback: (data: unknown) => void): () => void {
    if (!ALLOWED_STREAM_CHANNELS.includes(event as typeof ALLOWED_STREAM_CHANNELS[number])) {
      console.warn(`Stream event not allowed: ${event}`);
      return () => {};
    }
    const handler = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(event, handler);
    return () => {
      ipcRenderer.removeListener(event, handler);
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: add preload bridge with whitelisted IPC channels"
```

---

### Task 13: IPC Handlers

**Files:**
- Create: `src/main/ipc.ts`

- [ ] **Step 1: Write src/main/ipc.ts**

```typescript
import { ipcMain, type BrowserWindow } from "electron";
import { IPC, STREAM } from "../shared/constants.js";
import { apiKeysSchema, settingsUpdateSchema, agentStartSchema } from "../shared/validators.js";
import * as auth from "../services/authService.js";
import { logger } from "../services/loggerService.js";
import { tradeEngine } from "../services/tradeEngine.js";
import { safetyService } from "../services/safetyService.js";
import { TradeModel } from "../db/models/Trade.js";
import { LogModel } from "../db/models/Log.js";
import { saveSession, clearSession } from "./sessionManager.js";

let currentUserId: string | null = null;

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
  if (id) logger.setUserId(id);
  else logger.clearUserId();
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const send = (channel: string, data: unknown) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  // ─── Auth ────────────────────────────────────────────
  ipcMain.handle(IPC.AUTH_REGISTER, async (_e, data) => {
    const result = await auth.register(data);
    saveSession(result.token);
    setCurrentUserId(result.session.userId);
    await logger.info("AUTH", `User registered: ${result.session.email}`);
    return { session: result.session, settings: result.settings };
  });

  ipcMain.handle(IPC.AUTH_LOGIN, async (_e, data) => {
    const result = await auth.login(data);
    saveSession(result.token);
    setCurrentUserId(result.session.userId);
    await logger.info("AUTH", `User logged in: ${result.session.email}`);
    return { session: result.session, settings: result.settings };
  });

  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    if (tradeEngine.isRunning()) await tradeEngine.stop();
    setCurrentUserId(null);
    clearSession();
    await logger.info("AUTH", "User logged out");
  });

  ipcMain.handle(IPC.AUTH_SESSION, async () => {
    // Session restoration is handled in main.ts at startup
    return null;
  });

  // ─── Settings ────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_SAVE_API_KEYS, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = apiKeysSchema.parse(data);
    await auth.saveApiKeys(currentUserId, parsed.exchange, parsed.apiKey, parsed.apiSecret);
    await logger.info("SYSTEM", `API keys saved for ${parsed.exchange}`);
  });

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    return auth.getSettings(currentUserId);
  });

  ipcMain.handle(IPC.SETTINGS_UPDATE, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = settingsUpdateSchema.parse(data);
    const settings = await auth.updateSettings(currentUserId, parsed);
    return settings;
  });

  // ─── Portfolio & Positions ───────────────────────────
  ipcMain.handle(IPC.PORTFOLIO_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    // Return last known portfolio if engine is running, otherwise empty
    return null;
  });

  ipcMain.handle(IPC.POSITIONS_GET, async () => {
    if (!currentUserId) throw new Error("Not authenticated");
    return [];
  });

  // ─── Trades ──────────────────────────────────────────
  ipcMain.handle(IPC.TRADES_HISTORY, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const limit = (data as { limit?: number })?.limit ?? 50;
    const trades = await TradeModel.find({ userId: currentUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return trades.map((t) => ({
      _id: t._id.toString(),
      userId: t.userId.toString(),
      symbol: t.symbol,
      side: t.side,
      type: t.type,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      pnl: t.pnl,
      status: t.status,
      source: t.source,
      exchange: t.exchange,
      mode: t.mode,
      aiDecision: t.aiDecision,
      riskCheck: t.riskCheck,
      createdAt: t.createdAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    }));
  });

  // ─── AI ──────────────────────────────────────────────
  ipcMain.handle(IPC.AI_LAST_DECISION, async () => {
    return tradeEngine.getLastAIDecision();
  });

  // ─── Agent Control ───────────────────────────────────
  ipcMain.handle(IPC.AGENT_START, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const parsed = agentStartSchema.parse(data);

    if (safetyService.getState().frozen) {
      safetyService.resetFreeze();
    }

    tradeEngine.setCallbacks({
      onMarketTick: (tick) => send(STREAM.MARKET_TICK, tick),
      onPortfolio: (snap) => send(STREAM.PORTFOLIO, snap),
      onPositions: (positions) => send(STREAM.POSITIONS, positions),
      onTradeExecuted: (trade) => send(STREAM.TRADE_EXECUTED, trade),
      onAIDecision: (decision) => send(STREAM.AI_DECISION, decision),
      onAgentStatus: (status) => send(STREAM.AGENT_STATUS, status),
    });

    await tradeEngine.start(currentUserId, parsed.symbol);
    await auth.updateSettings(currentUserId, { agentModeEnabled: true });
  });

  ipcMain.handle(IPC.AGENT_STOP, async () => {
    await tradeEngine.stop();
    if (currentUserId) {
      await auth.updateSettings(currentUserId, { agentModeEnabled: false });
    }
  });

  ipcMain.handle(IPC.AGENT_KILL_SWITCH, async () => {
    await tradeEngine.killSwitch();
    if (currentUserId) {
      await auth.updateSettings(currentUserId, { agentModeEnabled: false });
    }
  });

  // ─── Logs ────────────────────────────────────────────
  ipcMain.handle(IPC.LOGS_RECENT, async (_e, data) => {
    if (!currentUserId) throw new Error("Not authenticated");
    const limit = (data as { limit?: number })?.limit ?? 100;
    const logs = await LogModel.find({ userId: currentUserId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs.map((l) => ({
      _id: l._id.toString(),
      userId: l.userId.toString(),
      level: l.level,
      category: l.category,
      message: l.message,
      meta: l.meta,
      timestamp: l.timestamp.toISOString(),
    }));
  });

  // ─── Log streaming (always active) ──────────────────
  logger.on("log", (entry) => send(STREAM.LOG, entry));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: add IPC handler registry with all 15 invoke channels and 7 streams"
```

---

### Task 14: Electron Main Process

**Files:**
- Create: `src/main/main.ts`

- [ ] **Step 1: Write src/main/main.ts**

```typescript
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { connectMongo } from "../db/mongoConnection.js";
import { registerIpcHandlers, setCurrentUserId } from "./ipc.js";
import { getToken } from "./sessionManager.js";
import * as auth from "../services/authService.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "TradeMAX",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "../preload/preload/index.js"),
    },
  });

  registerIpcHandlers(mainWindow);

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function restoreSession(): Promise<void> {
  const token = getToken();
  if (!token || !mainWindow) return;

  const result = await auth.restoreSession(token);
  if (result) {
    setCurrentUserId(result.session.userId);
    mainWindow.webContents.send("session:restored", {
      session: result.session,
      settings: result.settings,
    });
  }
}

app.whenReady().then(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI not set");
    await connectMongo(mongoUri);
  } catch (err) {
    console.error("[FATAL] MongoDB connection failed:", err);
    app.quit();
    return;
  }

  await createWindow();
  await restoreSession();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/main/main.ts
git commit -m "feat: add Electron main process with MongoDB init and session restore"
```

---

## Phase 4: React Renderer

### Task 15: Renderer Entry + Styles + Store

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/vite-env.d.ts`
- Create: `src/renderer/styles/index.css`
- Create: `src/renderer/store/appStore.ts`

- [ ] **Step 1: Create renderer directories**

```bash
mkdir -p src/renderer/styles src/renderer/store src/renderer/pages src/renderer/components
```

- [ ] **Step 2: Write src/renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TradeMAX</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'" />
  </head>
  <body class="bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write src/renderer/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

interface TradeMaxAPI {
  invoke(channel: string, data?: unknown): Promise<unknown>;
  on(event: string, callback: (data: unknown) => void): () => void;
}

declare global {
  interface Window {
    api: TradeMaxAPI;
  }
}

export {};
```

- [ ] **Step 4: Write src/renderer/styles/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root[data-theme="dark"] {
  --bg-primary: #0a0a0f;
  --bg-surface: rgba(255, 255, 255, 0.05);
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --border: rgba(255, 255, 255, 0.1);
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);
}

:root[data-theme="light"] {
  --bg-primary: #f8f8fc;
  --bg-surface: rgba(0, 0, 0, 0.03);
  --text-primary: #1a1a2e;
  --text-secondary: #6b6b80;
  --border: rgba(0, 0, 0, 0.1);
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.08);
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
}

.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 12px;
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.kill-switch-pulse {
  animation: pulse-red 2s infinite;
}
```

- [ ] **Step 5: Write src/renderer/store/appStore.ts**

```typescript
import { create } from "zustand";
import type {
  UserSession,
  UserSettings,
  PortfolioSnapshot,
  Position,
  Trade,
  AIDecision,
  AgentStatus,
  LogEntry,
  MarketTick,
} from "../../shared/types.js";

interface AppState {
  currentScreen: "intro" | "auth" | "dashboard";
  authMode: "login" | "register";

  user: UserSession | null;
  settings: UserSettings | null;

  theme: "dark" | "light";

  portfolio: PortfolioSnapshot | null;
  positions: Position[];
  trades: Trade[];
  lastAIDecision: AIDecision | null;
  agentStatus: AgentStatus;
  logs: LogEntry[];
  marketTick: MarketTick | null;

  setScreen: (screen: AppState["currentScreen"]) => void;
  setAuthMode: (mode: AppState["authMode"]) => void;
  setUser: (user: UserSession | null) => void;
  setSettings: (settings: UserSettings | null) => void;
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;

  setPortfolio: (p: PortfolioSnapshot) => void;
  setPositions: (p: Position[]) => void;
  addTrade: (t: Trade) => void;
  setTrades: (t: Trade[]) => void;
  setLastAIDecision: (d: AIDecision) => void;
  setAgentStatus: (s: AgentStatus) => void;
  addLog: (l: LogEntry) => void;
  setLogs: (l: LogEntry[]) => void;
  setMarketTick: (t: MarketTick) => void;

  reset: () => void;
}

const MAX_LOGS = 200;

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "intro",
  authMode: "login",

  user: null,
  settings: null,

  theme: "dark",

  portfolio: null,
  positions: [],
  trades: [],
  lastAIDecision: null,
  agentStatus: { running: false, frozen: false },
  logs: [],
  marketTick: null,

  setScreen: (screen) => set({ currentScreen: screen }),
  setAuthMode: (mode) => set({ authMode: mode }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  setPortfolio: (portfolio) => set({ portfolio }),
  setPositions: (positions) => set({ positions }),
  addTrade: (t) => set((s) => ({ trades: [t, ...s.trades].slice(0, 50) })),
  setTrades: (trades) => set({ trades }),
  setLastAIDecision: (d) => set({ lastAIDecision: d }),
  setAgentStatus: (s) => set({ agentStatus: s }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, MAX_LOGS) })),
  setLogs: (logs) => set({ logs }),
  setMarketTick: (t) => set({ marketTick: t }),

  reset: () =>
    set({
      currentScreen: "intro",
      user: null,
      settings: null,
      portfolio: null,
      positions: [],
      trades: [],
      lastAIDecision: null,
      agentStatus: { running: false, frozen: false },
      logs: [],
      marketTick: null,
    }),
}));
```

- [ ] **Step 6: Write src/renderer/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/main.tsx src/renderer/vite-env.d.ts src/renderer/styles/index.css src/renderer/store/appStore.ts
git commit -m "feat: add renderer entry, Zustand store, theme CSS, and type declarations"
```

---

### Task 16: GlassCard + App Shell

**Files:**
- Create: `src/renderer/components/GlassCard.tsx`
- Create: `src/renderer/App.tsx`

- [ ] **Step 1: Write src/renderer/components/GlassCard.tsx**

```tsx
import React from "react";
import { clsx } from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div className={clsx("glass p-4", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write src/renderer/App.tsx**

```tsx
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "./store/appStore";
import { IntroPage } from "./pages/IntroPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { STREAM } from "../shared/constants";
import type {
  PortfolioSnapshot,
  Position,
  Trade,
  AIDecision,
  AgentStatus,
  LogEntry,
  MarketTick,
  UserSession,
  UserSettings,
} from "../shared/types";

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const setScreen = useAppStore((s) => s.setScreen);
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);

  // Subscribe to all streams
  useEffect(() => {
    const store = useAppStore.getState();
    const unsubs: (() => void)[] = [];

    unsubs.push(window.api.on(STREAM.MARKET_TICK, (d) => store.setMarketTick(d as MarketTick)));
    unsubs.push(window.api.on(STREAM.PORTFOLIO, (d) => store.setPortfolio(d as PortfolioSnapshot)));
    unsubs.push(window.api.on(STREAM.POSITIONS, (d) => store.setPositions(d as Position[])));
    unsubs.push(window.api.on(STREAM.TRADE_EXECUTED, (d) => store.addTrade(d as Trade)));
    unsubs.push(window.api.on(STREAM.AI_DECISION, (d) => store.setLastAIDecision(d as AIDecision)));
    unsubs.push(window.api.on(STREAM.AGENT_STATUS, (d) => store.setAgentStatus(d as AgentStatus)));
    unsubs.push(window.api.on(STREAM.LOG, (d) => store.addLog(d as LogEntry)));

    // Listen for session restore from main process
    unsubs.push(
      window.api.on("session:restored", (d) => {
        const data = d as { session: UserSession; settings: UserSettings };
        store.setUser(data.session);
        store.setSettings(data.settings);
        if (data.settings.themePreference) {
          store.setTheme(data.settings.themePreference);
        }
        store.setScreen("dashboard");
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <IntroPage />
          </motion.div>
        )}
        {currentScreen === "auth" && (
          <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <AuthPage />
          </motion.div>
        )}
        {currentScreen === "dashboard" && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <DashboardPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/GlassCard.tsx src/renderer/App.tsx
git commit -m "feat: add GlassCard component and App shell with animated screen transitions"
```

---

### Task 17: Intro Page

**Files:**
- Create: `src/renderer/pages/IntroPage.tsx`

- [ ] **Step 1: Write src/renderer/pages/IntroPage.tsx**

```tsx
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";

export function IntroPage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  const goAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setScreen("auth");
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-8 bg-[var(--bg-primary)]">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-6xl font-bold text-primary tracking-tight">
          Trade<span className="text-accent">MAX</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] text-lg">
          Autonomous Crypto Trading Agent
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex gap-4"
      >
        <button
          onClick={() => goAuth("login")}
          className="px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => goAuth("register")}
          className="px-8 py-3 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
        >
          Register
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/IntroPage.tsx
git commit -m "feat: add animated intro page with login/register buttons"
```

---

### Task 18: Auth Page

**Files:**
- Create: `src/renderer/pages/AuthPage.tsx`

- [ ] **Step 1: Write src/renderer/pages/AuthPage.tsx**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { GlassCard } from "../components/GlassCard";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";

export function AuthPage() {
  const authMode = useAppStore((s) => s.authMode);
  const setAuthMode = useAppStore((s) => s.setAuthMode);
  const setScreen = useAppStore((s) => s.setScreen);
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = authMode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const channel = isRegister ? IPC.AUTH_REGISTER : IPC.AUTH_LOGIN;
      const payload = isRegister ? { name, email, password } : { email, password };

      const result = (await window.api.invoke(channel, payload)) as {
        session: UserSession;
        settings: UserSettings;
      };

      setUser(result.session);
      setSettings(result.settings);
      if (result.settings.themePreference) {
        setTheme(result.settings.themePreference);
      }
      setScreen("dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("EMAIL_EXISTS")) setError("An account with this email already exists.");
      else if (msg.includes("INVALID_CREDENTIALS")) setError("Invalid email or password.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <GlassCard className="w-[400px] p-8">
          <h2 className="text-2xl font-bold text-center mb-1">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
            {isRegister ? "Set up your TradeMAX account" : "Sign in to your account"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isRegister && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : isRegister ? "Register" : "Login"}
            </button>
          </form>

          <p className="text-sm text-center mt-4 text-[var(--text-secondary)]">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setAuthMode(isRegister ? "login" : "register")}
              className="text-primary hover:underline"
            >
              {isRegister ? "Login" : "Register"}
            </button>
          </p>

          <button
            onClick={() => setScreen("intro")}
            className="block mx-auto mt-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Back
          </button>
        </GlassCard>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/AuthPage.tsx
git commit -m "feat: add auth page with login/register form toggle"
```

---

### Task 19: Sidebar Component

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`

- [ ] **Step 1: Write src/renderer/components/Sidebar.tsx**

```tsx
import { GlassCard } from "./GlassCard";
import { AgentControlPanel } from "./AgentControlPanel";
import { PortfolioPanel } from "./PortfolioPanel";
import { AIDecisionFeed } from "./AIDecisionFeed";
import { APIKeysPanel } from "./APIKeysPanel";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function Sidebar() {
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const reset = useAppStore((s) => s.reset);

  const handleLogout = async () => {
    await window.api.invoke(IPC.AUTH_LOGOUT);
    reset();
  };

  return (
    <aside className="w-[260px] min-w-[260px] h-screen flex flex-col gap-3 p-3 overflow-y-auto border-r border-[var(--border)]">
      {/* Branding */}
      <div className="px-3 py-4 text-center">
        <h1 className="text-xl font-bold text-primary">
          Trade<span className="text-accent">MAX</span>
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{user?.email}</p>
      </div>

      {/* Agent Control */}
      <AgentControlPanel />

      {/* Portfolio */}
      <PortfolioPanel />

      {/* AI Feed */}
      <AIDecisionFeed />

      {/* Settings */}
      <GlassCard className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Settings</h3>

        <APIKeysPanel />

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-[var(--text-secondary)]">Theme</span>
          <button
            onClick={async () => {
              toggleTheme();
              const next = theme === "dark" ? "light" : "dark";
              await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: next });
            }}
            className="text-sm px-3 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] hover:border-primary transition-colors"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mt-2 w-full py-2 text-sm rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
        >
          Logout
        </button>
      </GlassCard>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Sidebar.tsx
git commit -m "feat: add sidebar component with branding, controls, and settings"
```

---

### Task 20: Dashboard Panel Components

**Files:**
- Create: `src/renderer/components/AgentControlPanel.tsx`
- Create: `src/renderer/components/PortfolioPanel.tsx`
- Create: `src/renderer/components/AIDecisionFeed.tsx`
- Create: `src/renderer/components/PositionsPanel.tsx`
- Create: `src/renderer/components/TradesPanel.tsx`
- Create: `src/renderer/components/LiveLogPanel.tsx`
- Create: `src/renderer/components/APIKeysPanel.tsx`

- [ ] **Step 1: Write src/renderer/components/AgentControlPanel.tsx**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function AgentControlPanel() {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [confirmKill, setConfirmKill] = useState(false);

  const handleToggleAgent = async () => {
    if (agentStatus.running) {
      await window.api.invoke(IPC.AGENT_STOP);
    } else {
      await window.api.invoke(IPC.AGENT_START, { symbol });
    }
  };

  const handleKillSwitch = async () => {
    if (!confirmKill) {
      setConfirmKill(true);
      setTimeout(() => setConfirmKill(false), 3000);
      return;
    }
    await window.api.invoke(IPC.AGENT_KILL_SWITCH);
    setConfirmKill(false);
  };

  const handleModeChange = async (mode: "spot" | "futures") => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, { tradingMode: mode });
    setSettings(updated as typeof settings);
  };

  const handleExchangeChange = async (exchange: "binance" | "bybit") => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, { selectedExchange: exchange });
    setSettings(updated as typeof settings);
  };

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Agent Control</h3>

      {/* Agent Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Agent Mode</span>
        <button
          onClick={handleToggleAgent}
          disabled={agentStatus.frozen}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            agentStatus.running ? "bg-green-500" : "bg-[var(--bg-surface)]"
          } ${agentStatus.frozen ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <motion.div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
            animate={{ left: agentStatus.running ? 26 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {agentStatus.frozen && (
        <p className="text-xs text-red-400">Frozen: {agentStatus.reason}</p>
      )}

      {/* Symbol */}
      <input
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        disabled={agentStatus.running}
        placeholder="Symbol"
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary disabled:opacity-50"
      />

      {/* Exchange Selector */}
      <div className="flex gap-2">
        {(["binance", "bybit"] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => handleExchangeChange(ex)}
            disabled={agentStatus.running}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              settings?.selectedExchange === ex
                ? "border-primary bg-primary/10 text-primary"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-primary/50"
            } disabled:opacity-50`}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        {(["spot", "futures"] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            disabled={agentStatus.running}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              settings?.tradingMode === m
                ? "border-accent bg-accent/10 text-accent"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-accent/50"
            } disabled:opacity-50`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Kill Switch */}
      <button
        onClick={handleKillSwitch}
        className={`w-full py-2 text-sm font-bold rounded-lg transition-colors ${
          confirmKill
            ? "bg-red-600 text-white"
            : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
        } kill-switch-pulse`}
      >
        {confirmKill ? "CONFIRM KILL" : "EMERGENCY KILL SWITCH"}
      </button>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Write src/renderer/components/PortfolioPanel.tsx**

```tsx
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function PortfolioPanel() {
  const portfolio = useAppStore((s) => s.portfolio);
  const marketTick = useAppStore((s) => s.marketTick);

  return (
    <GlassCard className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Portfolio</h3>

      <div className="text-xl font-bold">
        ${portfolio?.totalBalance?.toFixed(2) ?? "0.00"}
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Available</span>
        <span>${portfolio?.availableBalance?.toFixed(2) ?? "0.00"}</span>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Daily PnL</span>
        <span className={portfolio?.dailyPnl && portfolio.dailyPnl >= 0 ? "text-green-400" : "text-red-400"}>
          {portfolio?.dailyPnl !== undefined ? (portfolio.dailyPnl >= 0 ? "+" : "") + portfolio.dailyPnl.toFixed(2) : "0.00"}
        </span>
      </div>

      {marketTick && (
        <div className="flex justify-between text-xs mt-1 pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--text-secondary)]">{marketTick.symbol}</span>
          <span className="text-accent font-mono">${marketTick.price.toLocaleString()}</span>
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 3: Write src/renderer/components/AIDecisionFeed.tsx**

```tsx
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function AIDecisionFeed() {
  const decision = useAppStore((s) => s.lastAIDecision);

  return (
    <GlassCard className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">AI Decision</h3>

      {!decision ? (
        <p className="text-xs text-[var(--text-secondary)]">No decisions yet</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-bold ${
                decision.decision === "BUY"
                  ? "text-green-400"
                  : decision.decision === "SELL"
                  ? "text-red-400"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {decision.decision}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {(decision.confidence * 100).toFixed(0)}% conf
            </span>
          </div>

          {decision.decision !== "HOLD" && (
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div>
                <span className="text-[var(--text-secondary)]">Entry</span>
                <p className="font-mono">{decision.entry.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">SL</span>
                <p className="font-mono text-red-400">{decision.stop_loss.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">TP</span>
                <p className="font-mono text-green-400">{decision.take_profit.toLocaleString()}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{decision.reason}</p>
        </>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 4: Write src/renderer/components/PositionsPanel.tsx**

```tsx
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function PositionsPanel() {
  const positions = useAppStore((s) => s.positions);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Live Positions</h3>

      {positions.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No open positions</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="pb-2 text-left">Symbol</th>
                <th className="pb-2 text-left">Side</th>
                <th className="pb-2 text-right">Entry</th>
                <th className="pb-2 text-right">Mark</th>
                <th className="pb-2 text-right">PnL</th>
                <th className="pb-2 text-right">Liq.</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.symbol}-${i}`} className="border-b border-[var(--border)]/50">
                  <td className="py-2 font-mono">{p.symbol}</td>
                  <td className={`py-2 font-bold ${p.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{p.side}</td>
                  <td className="py-2 text-right font-mono">{p.entryPrice.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono">{p.markPrice.toLocaleString()}</td>
                  <td className={`py-2 text-right font-mono ${p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                    {p.liquidationPrice ? p.liquidationPrice.toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 5: Write src/renderer/components/TradesPanel.tsx**

```tsx
import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { Trade } from "../../shared/types";

export function TradesPanel() {
  const trades = useAppStore((s) => s.trades);
  const setTrades = useAppStore((s) => s.setTrades);

  useEffect(() => {
    window.api.invoke(IPC.TRADES_HISTORY, { limit: 50 }).then((data) => {
      setTrades(data as Trade[]);
    });
  }, []);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Recent Trades</h3>

      {trades.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No trades yet</p>
      ) : (
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--bg-primary)]">
              <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="pb-2 text-left">Symbol</th>
                <th className="pb-2 text-left">Side</th>
                <th className="pb-2 text-right">PnL</th>
                <th className="pb-2 text-left">Source</th>
                <th className="pb-2 text-left">Status</th>
                <th className="pb-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t._id} className="border-b border-[var(--border)]/50">
                  <td className="py-2 font-mono">{t.symbol}</td>
                  <td className={`py-2 font-bold ${t.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.side}</td>
                  <td className={`py-2 text-right font-mono ${(t.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.source === "AI" ? "bg-primary/20 text-primary" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}>
                      {t.source}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.status === "OPEN" ? "bg-accent/20 text-accent" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">
                    {new Date(t.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 6: Write src/renderer/components/LiveLogPanel.tsx**

```tsx
import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { LogEntry } from "../../shared/types";

const levelColors: Record<string, string> = {
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
};

const categoryColors: Record<string, string> = {
  AUTH: "bg-blue-500/20 text-blue-400",
  TRADE: "bg-green-500/20 text-green-400",
  AI: "bg-purple-500/20 text-purple-400",
  RISK: "bg-orange-500/20 text-orange-400",
  SAFETY: "bg-red-500/20 text-red-400",
  SYSTEM: "bg-gray-500/20 text-gray-400",
};

export function LiveLogPanel() {
  const logs = useAppStore((s) => s.logs);
  const setLogs = useAppStore((s) => s.setLogs);

  useEffect(() => {
    window.api.invoke(IPC.LOGS_RECENT, { limit: 100 }).then((data) => {
      setLogs(data as LogEntry[]);
    });
  }, []);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Live Logs</h3>

      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No logs yet</p>
        ) : (
          logs.map((log, i) => (
            <div key={log._id ?? i} className="flex items-start gap-2 text-xs py-1 border-b border-[var(--border)]/30">
              <span className={`font-mono min-w-[36px] ${levelColors[log.level] ?? ""}`}>
                {log.level}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] min-w-[48px] text-center ${categoryColors[log.category] ?? ""}`}>
                {log.category}
              </span>
              <span className="text-[var(--text-primary)] flex-1">{log.message}</span>
              <span className="text-[var(--text-secondary)] min-w-[60px] text-right">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 7: Write src/renderer/components/APIKeysPanel.tsx**

```tsx
import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function APIKeysPanel() {
  const settings = useAppStore((s) => s.settings);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !apiSecret || !settings) return;
    await window.api.invoke(IPC.SETTINGS_SAVE_API_KEYS, {
      exchange: settings.selectedExchange,
      apiKey,
      apiSecret,
    });
    setApiKey("");
    setApiSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-[var(--text-secondary)]">
        {settings?.selectedExchange?.toUpperCase()} API Keys
      </span>
      <input
        type="password"
        placeholder="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
      />
      <input
        type="password"
        placeholder="API Secret"
        value={apiSecret}
        onChange={(e) => setApiSecret(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
      />
      <button
        onClick={handleSave}
        disabled={!apiKey || !apiSecret}
        className="w-full py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-30 transition-colors"
      >
        {saved ? "Saved!" : "Save Keys"}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/AgentControlPanel.tsx src/renderer/components/PortfolioPanel.tsx src/renderer/components/AIDecisionFeed.tsx src/renderer/components/PositionsPanel.tsx src/renderer/components/TradesPanel.tsx src/renderer/components/LiveLogPanel.tsx src/renderer/components/APIKeysPanel.tsx
git commit -m "feat: add all dashboard panel components (agent, portfolio, AI, positions, trades, logs, keys)"
```

---

### Task 21: Dashboard Page

**Files:**
- Create: `src/renderer/pages/DashboardPage.tsx`

- [ ] **Step 1: Write src/renderer/pages/DashboardPage.tsx**

```tsx
import { motion } from "framer-motion";
import { Sidebar } from "../components/Sidebar";
import { PositionsPanel } from "../components/PositionsPanel";
import { TradesPanel } from "../components/TradesPanel";
import { LiveLogPanel } from "../components/LiveLogPanel";

export function DashboardPage() {
  return (
    <div className="h-screen w-screen flex">
      <Sidebar />

      <main className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PositionsPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TradesPanel />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <LiveLogPanel />
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/DashboardPage.tsx
git commit -m "feat: add dashboard page with sidebar + main area layout"
```

---

## Phase 5: Integration & Verification

### Task 22: Build Verification

**Files:** No new files — verification only.

- [ ] **Step 1: Verify TypeScript compilation for all targets**

```bash
npx tsc -p tsconfig.main.json --noEmit
```
Expected: No errors

```bash
npx tsc -p tsconfig.preload.json --noEmit
```
Expected: No errors

- [ ] **Step 2: Build renderer with Vite**

```bash
npx vite build --config vite.config.ts
```
Expected: Successful build in `dist/renderer/`

- [ ] **Step 3: Full build**

```bash
npm run build
```
Expected: `dist/main/`, `dist/preload/`, `dist/renderer/` all populated

- [ ] **Step 4: Fix any compilation errors found in steps 1–3**

Iterate until all three targets compile cleanly.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve compilation errors from build verification"
```

---

### Task 23: Update Environment & Documentation

**Files:**
- Update: `.env.example`
- Update: `docs/architecture.md`
- Update: `docs/setup-macos.md`
- Update: `docs/api-integration.md`

- [ ] **Step 1: Write updated .env.example**

The `.env.example` should match the spec in Section 14.1. Verify it already does from Task 1, or update:

```env
# App
NODE_ENV=development
JWT_SECRET=replace_with_64_char_random_hex
APP_MASTER_KEY=replace_with_64_char_random_hex

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Claude AI
CLAUDE_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-sonnet-4-20250514

# Defaults
DEFAULT_SYMBOL=BTCUSDT
```

- [ ] **Step 2: Update docs/architecture.md**

Replace the existing file with content reflecting the v2 rebuild: monolithic main + thin renderer architecture, sidebar + main area layout, single exchange per session, all IPC channels, safety system with persistence.

- [ ] **Step 3: Update docs/setup-macos.md**

Ensure it reflects: MongoDB Atlas (not local), the current scripts, and the `.env` keys needed.

- [ ] **Step 4: Update docs/api-integration.md**

Reflect both Binance and Bybit unified interface, Claude strict JSON contract, exchange factory pattern.

- [ ] **Step 5: Commit**

```bash
git add .env.example docs/
git commit -m "docs: update architecture, setup, and API integration docs for v2 rebuild"
```

---

### Task 24: Smoke Test — Full App Launch

**Files:** No new files — manual verification.

- [ ] **Step 1: Create .env from .env.example with real values**

```bash
cp .env.example .env
```
Then edit `.env` with real MongoDB Atlas URI and Claude API key.

- [ ] **Step 2: Start dev mode**

```bash
npm run dev
```

Expected: Vite starts on :5173, TypeScript compiles, Electron window opens.

- [ ] **Step 3: Verify Intro Page**

Expected: TradeMAX logo with purple/yellow colors, Login and Register buttons, smooth entrance animation.

- [ ] **Step 4: Test registration flow**

Click Register → fill form → submit. Expected: MongoDB creates user, redirects to Dashboard.

- [ ] **Step 5: Verify Dashboard layout**

Expected: Sidebar on left (260px) with branding, agent control, portfolio, AI feed, settings. Main area on right with positions, trades, logs panels.

- [ ] **Step 6: Test theme toggle**

Click theme button in sidebar settings. Expected: Dark ↔ Light switch with CSS variable changes.

- [ ] **Step 7: Test logout and re-login**

Logout → should return to Intro. Login → should restore to Dashboard.

- [ ] **Step 8: Fix any issues found during smoke test**

Iterate until the full flow works end-to-end.

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve issues found during smoke test"
```

---

## Summary

| Phase | Tasks | What's Built |
|-------|-------|-------------|
| 1: Scaffold | 1–2 | Clean project config, shared types/constants/validators |
| 2: Core Services | 3–11 | MongoDB, auth, encryption, logging, safety, risk engine, AI, exchanges, trade engine |
| 3: Electron Shell | 12–14 | Preload bridge, IPC handlers, main process |
| 4: React Renderer | 15–21 | Store, styles, all pages, all components, dashboard layout |
| 5: Integration | 22–24 | Build verification, docs, smoke test |

**Total: 24 tasks, ~120 steps**
