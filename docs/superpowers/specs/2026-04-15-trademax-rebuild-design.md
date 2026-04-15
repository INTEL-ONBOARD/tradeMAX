# TradeMAX — Full Rebuild Design Spec

**Date:** 2026-04-15
**Type:** Complete tear-down and rebuild
**Stack:** Electron + React + Node.js + MongoDB Atlas + Binance/Bybit + Claude API

---

## 1. System Purpose

TradeMAX is an autonomous crypto trading desktop application for macOS. An AI agent (Claude) analyzes live market data and generates trade signals. When agent mode is enabled, the system evaluates signals through a strict risk engine and executes approved trades on the user's selected exchange.

**Core safety guarantees:**
- AI is advisory only — it cannot execute trades directly
- Every trade must pass all 8 risk engine guardrails before execution
- Emergency kill switch overrides all systems including AI
- Agent auto-freezes after consecutive losses, drawdown breaches, or API failures
- No secrets are ever exposed to the renderer process

---

## 2. Architecture

### 2.1 Approach: Monolithic Main Process + Thin Renderer

All business logic runs in the Electron main process. The React renderer is a pure display layer that communicates exclusively through IPC.

```
┌─────────────────────────────────────────────────────┐
│                  MAIN PROCESS                        │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ AuthSvc  │  │EncryptSvc│  │   LoggerService   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │              Trade Engine                      │   │
│  │  ┌─────────┐ ┌─────────┐ ┌────────────────┐  │   │
│  │  │Exchange │→│AI Svc   │→│ Risk Engine     │  │   │
│  │  │WebSocket│ │(Claude) │ │ (8 guardrails)  │  │   │
│  │  └─────────┘ └─────────┘ └────────────────┘  │   │
│  │       ↓            ↓             ↓            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌────────────────┐  │   │
│  │  │Exchange │ │Safety   │ │  MongoDB        │  │   │
│  │  │REST API │ │Service  │ │  (Atlas)        │  │   │
│  │  └─────────┘ └─────────┘ └────────────────┘  │   │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────┐                                │
│  │  Session Manager  │  (electron-store)             │
│  └──────────────────┘                                │
│                                                      │
│  ┌──────────────────┐                                │
│  │   IPC Handlers    │  (27 channels)                │
│  └────────┬─────────┘                                │
└───────────┼─────────────────────────────────────────┘
            │ contextBridge (preload)
┌───────────┼─────────────────────────────────────────┐
│  RENDERER │ (React + Zustand + Tailwind + Framer)   │
│           ↓                                          │
│  window.api.invoke('channel', data)                  │
│  window.api.on('event', callback)                    │
│                                                      │
│  ┌────────┐  ┌────────┐  ┌─────────────┐           │
│  │ Intro  │→ │  Auth  │→ │  Dashboard   │           │
│  │ Page   │  │  Page  │  │  (Sidebar +  │           │
│  └────────┘  └────────┘  │   Main Area) │           │
│                           └─────────────┘           │
└─────────────────────────────────────────────────────┘
```

### 2.2 Security Model

| Rule | Enforcement |
|------|-------------|
| `contextIsolation: true` | Electron BrowserWindow config |
| `nodeIntegration: false` | Electron BrowserWindow config |
| All secrets in main process only | Preload bridge exposes typed API, no raw IPC |
| API keys encrypted at rest | AES-256-GCM with PBKDF2-derived key |
| JWT never sent to renderer | Renderer receives `{userId, name, email}` only |
| No `remote` module | Disabled entirely |

### 2.3 Folder Structure

```
/src
  /main
    main.ts              — Electron window creation, app lifecycle, MongoDB connect
    ipc.ts               — All IPC handler registrations (27 channels)
    sessionManager.ts    — JWT persistence via electron-store
  /preload
    index.ts             — contextBridge exposing typed window.api
  /renderer
    index.html           — Vite entry HTML
    main.tsx             — React root mount
    vite-env.d.ts        — Vite type declarations
    App.tsx              — Screen router (Intro → Auth → Dashboard)
    /store
      appStore.ts        — Zustand global state
    /pages
      IntroPage.tsx      — Animated landing screen
      AuthPage.tsx       — Login/register forms
      DashboardPage.tsx  — Sidebar + main area layout
    /components
      GlassCard.tsx      — Base glassmorphism wrapper
      Sidebar.tsx        — Fixed left sidebar
      PortfolioPanel.tsx — Balance, PnL, allocation
      AgentControlPanel.tsx — ON/OFF, symbol, mode, kill switch
      AIDecisionFeed.tsx — Latest Claude decision display
      PositionsPanel.tsx — Open positions table
      TradesPanel.tsx    — Recent trades feed
      LiveLogPanel.tsx   — Real-time log stream
      APIKeysPanel.tsx   — Exchange key input form
    /styles
      index.css          — Tailwind directives + CSS custom properties
  /services
    authService.ts       — Register, login, JWT, bcrypt
    encryptionService.ts — AES-256-GCM encrypt/decrypt
    loggerService.ts     — EventEmitter + MongoDB log persistence
    aiService.ts         — Claude API integration
    riskEngine.ts        — 8-guardrail trade validator
    safetyService.ts     — Emergency state, freeze controls
    binanceService.ts    — Binance REST + WebSocket
    bybitService.ts      — Bybit REST + WebSocket (via bybit-api SDK)
    tradeEngine.ts       — Core trading loop orchestrator
    exchangeFactory.ts   — Returns correct exchange service based on user selection
  /db
    mongoConnection.ts   — Mongoose connection to Atlas
    /models
      User.ts            — User schema
      Trade.ts           — Trade history schema
      Log.ts             — Audit log schema
  /shared
    types.ts             — All TypeScript interfaces and type unions
    constants.ts         — IPC channel names, defaults, enums
    validators.ts        — Zod schemas for runtime validation
```

---

## 3. IPC Surface

### 3.1 Invoke Channels (request/response)

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `auth:register` | renderer → main | `{name, email, password}` | `{userId, name, email}` |
| `auth:login` | renderer → main | `{email, password}` | `{userId, name, email}` |
| `auth:logout` | renderer → main | — | `void` |
| `auth:session` | renderer → main | — | `{userId, name, email} \| null` |
| `settings:save-api-keys` | renderer → main | `{exchange, apiKey, apiSecret}` | `void` |
| `settings:get` | renderer → main | — | `UserSettings` |
| `settings:update` | renderer → main | `Partial<UserSettings>` | `void` |
| `portfolio:get` | renderer → main | — | `PortfolioSnapshot` |
| `positions:get` | renderer → main | — | `Position[]` |
| `trades:history` | renderer → main | `{limit?: number}` | `Trade[]` |
| `ai:last-decision` | renderer → main | — | `AIDecision \| null` |
| `agent:start` | renderer → main | `{symbol: string}` | `void` |
| `agent:stop` | renderer → main | — | `void` |
| `agent:kill-switch` | renderer → main | — | `void` |
| `logs:recent` | renderer → main | `{limit?: number}` | `LogEntry[]` |

### 3.2 Event Streams (main → renderer, push-based)

| Event | Payload | Frequency |
|-------|---------|-----------|
| `stream:market-tick` | `{symbol, price, timestamp}` | Per WebSocket tick |
| `stream:portfolio` | `PortfolioSnapshot` | Every trade cycle |
| `stream:positions` | `Position[]` | Every trade cycle |
| `stream:trade-executed` | `Trade` | On execution |
| `stream:ai-decision` | `AIDecision` | Every AI call |
| `stream:agent-status` | `{running, frozen, reason?}` | On state change |
| `stream:log` | `LogEntry` | On every log event |

### 3.3 Preload Bridge Shape

```typescript
interface TradeMaxAPI {
  invoke(channel: string, data?: unknown): Promise<unknown>
  on(event: string, callback: (data: unknown) => void): () => void  // returns unsubscribe
}

// Exposed as window.api
```

---

## 4. Database Design

### 4.1 Connection

MongoDB Atlas cluster: `trademax.yuqiy9d.mongodb.net`
Database name: `trademax`
ODM: Mongoose 8.x

### 4.2 Collections

#### `users`

| Field | Type | Constraints |
|-------|------|-------------|
| `_id` | ObjectId | auto |
| `name` | string | required, trimmed |
| `email` | string | required, unique, lowercase, indexed |
| `password` | string | bcrypt hash, 12 salt rounds |
| `exchangeKeys.binance.apiKey` | string | AES-256-GCM encrypted |
| `exchangeKeys.binance.apiSecret` | string | AES-256-GCM encrypted |
| `exchangeKeys.bybit.apiKey` | string | AES-256-GCM encrypted |
| `exchangeKeys.bybit.apiSecret` | string | AES-256-GCM encrypted |
| `selectedExchange` | string | `"binance"` or `"bybit"`, default `"binance"` |
| `tradingMode` | string | `"spot"` or `"futures"`, default `"spot"` |
| `riskProfile.maxRiskPct` | number | default 2 |
| `riskProfile.maxDailyLossPct` | number | default 5 |
| `riskProfile.maxOpenPositions` | number | default 3 |
| `riskProfile.minConfidence` | number | default 0.75 |
| `riskProfile.maxLeverage` | number | default 10 |
| `agentModeEnabled` | boolean | default false |
| `themePreference` | string | `"dark"` or `"light"`, default `"dark"` |
| `createdAt` | Date | auto |
| `updatedAt` | Date | auto |

#### `trades`

| Field | Type | Constraints |
|-------|------|-------------|
| `_id` | ObjectId | auto |
| `userId` | ObjectId | ref → users, indexed |
| `symbol` | string | required, e.g. `"BTCUSDT"` |
| `side` | string | `"BUY"` or `"SELL"` |
| `type` | string | `"MARKET"` or `"LIMIT"` |
| `entryPrice` | number | required |
| `exitPrice` | number | null while open |
| `quantity` | number | required |
| `pnl` | number | null while open |
| `status` | string | `"OPEN"` or `"CLOSED"`, indexed |
| `source` | string | `"AI"`, `"MANUAL"`, or `"SYSTEM"` |
| `exchange` | string | `"binance"` or `"bybit"` |
| `mode` | string | `"spot"` or `"futures"` |
| `aiDecision` | object | snapshot of Claude's JSON response |
| `riskCheck` | object | snapshot of risk engine result |
| `createdAt` | Date | auto |
| `closedAt` | Date | null while open |

#### `logs`

| Field | Type | Constraints |
|-------|------|-------------|
| `_id` | ObjectId | auto |
| `userId` | ObjectId | ref → users, indexed |
| `level` | string | `"INFO"`, `"WARN"`, or `"ERROR"` |
| `category` | string | `"AUTH"`, `"TRADE"`, `"AI"`, `"RISK"`, `"SAFETY"`, or `"SYSTEM"` |
| `message` | string | human-readable description |
| `meta` | object | structured context (varies by category) |
| `timestamp` | Date | indexed, default now |

---

## 5. Authentication System

### 5.1 Registration Flow

1. Renderer sends `auth:register` with `{name, email, password}`
2. Main process validates with Zod (email format, password min 8 chars)
3. Check if email exists in MongoDB → reject with `EMAIL_EXISTS` if so
4. Hash password with bcrypt (12 salt rounds)
5. Create user document with defaults
6. Generate JWT (24h expiry, signed with `JWT_SECRET` from env)
7. Store JWT in electron-store (encrypted on disk)
8. Return `{userId, name, email}` to renderer (never the JWT)

### 5.2 Login Flow

1. Renderer sends `auth:login` with `{email, password}`
2. Find user by email → reject with `INVALID_CREDENTIALS` if not found
3. bcrypt.compare password → reject if mismatch
4. Generate JWT, store in electron-store
5. Return `{userId, name, email}`

### 5.3 Session Restoration

1. On app launch, main process reads JWT from electron-store
2. Verify JWT signature and expiry
3. If valid → fetch user from MongoDB → set session state → renderer gets user info via `auth:session`
4. If invalid/expired → clear store → renderer shows Intro page

### 5.4 Logout

1. Clear electron-store
2. Null session in main process
3. If agent running → stop trade engine → disconnect WebSocket
4. Renderer transitions to Intro page

---

## 6. Encryption Service

### 6.1 Algorithm

- AES-256-GCM (authenticated encryption)
- Key derived from `APP_MASTER_KEY` env var via PBKDF2 (100,000 iterations, SHA-512)
- Each encryption generates a random 16-byte IV
- Output format: `iv:authTag:ciphertext` (all hex-encoded)

### 6.2 Usage

- Encrypt: when user saves API keys via `settings:save-api-keys`
- Decrypt: when trade engine starts and needs exchange credentials
- Keys cleared from memory on agent stop or logout

---

## 7. Exchange Services

### 7.1 Single Exchange Per Session

User selects Binance or Bybit in settings. The `exchangeFactory` returns the correct service implementation. Trade engine only instantiates one exchange service at a time.

```typescript
// exchangeFactory.ts
function createExchangeService(exchange: "binance" | "bybit"): ExchangeService
```

### 7.2 Unified Interface

Both Binance and Bybit services implement this contract:

```typescript
interface ExchangeService {
  initialize(decryptedKeys: {apiKey: string, apiSecret: string}): Promise<void>
  destroy(): void

  getBalance(): Promise<PortfolioSnapshot>
  getOpenPositions(): Promise<Position[]>

  placeMarketOrder(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult>
  closePosition(symbol: string, side: "BUY" | "SELL", quantity: number): Promise<OrderResult>
  cancelAllOrders(symbol?: string): Promise<void>
  setLeverage(symbol: string, leverage: number): Promise<void>

  startTickerStream(symbol: string, callback: (tick: MarketTick) => void): void
  stopTickerStream(): void
}
```

### 7.3 Binance Implementation

- REST: `axios` with HMAC-SHA256 request signing
- WebSocket: `ws` library, `<symbol>@ticker` stream
- Spot endpoints: `/api/v3/account`, `/api/v3/order`
- Futures endpoints: `/fapi/v2/balance`, `/fapi/v2/positionRisk`, `/fapi/v3/order`
- WebSocket auto-reconnect: 3 retries, exponential backoff (1s, 2s, 4s)

### 7.4 Bybit Implementation

- SDK: `bybit-api` V5 unified account
- Category parameter switches between spot and linear futures
- `getWalletBalance`, `getPositionInfo`, `submitOrder`, `cancelAllOrders`
- WebSocket via SDK built-in stream: `tickers.<symbol>` topic

### 7.5 Error Handling

- 3 retries with exponential backoff (1s, 2s, 4s) on transient failures
- After 3 consecutive failures → emit `EXCHANGE_ERROR` to safety service → freeze trading
- HTTP 429 (rate limit): pause for `Retry-After` header duration
- API keys decrypted on `initialize()`, cleared on `destroy()`

---

## 8. AI Engine (Claude Integration)

### 8.1 Service Design

- Single `AIService` class in main process
- Uses `@anthropic-ai/sdk` with model from `CLAUDE_MODEL` env var
- Each call is stateless — full context provided per request
- Max response timeout: 30 seconds

### 8.2 System Prompt

```
You are a quantitative crypto trading analyst. Analyze the provided market data
and return a strict JSON trading decision. You are advisory only — your output
will be validated by a risk engine before any execution. Never recommend
risking more than the user's configured risk profile allows.
```

### 8.3 User Prompt (structured data)

```json
{
  "symbol": "BTCUSDT",
  "exchange": "binance",
  "mode": "futures",
  "currentPrice": 67432.50,
  "indicators": {
    "rsi": 42.3,
    "macd": { "line": -125.4, "signal": -98.2, "histogram": -27.2 }
  },
  "portfolio": {
    "totalBalance": 10000,
    "availableBalance": 7500,
    "dailyPnl": -120,
    "weeklyPnl": 340
  },
  "openPositions": [
    { "symbol": "ETHUSDT", "side": "BUY", "entryPrice": 3200, "unrealizedPnl": 45 }
  ],
  "riskProfile": {
    "maxRiskPct": 2,
    "maxDailyLossPct": 5,
    "maxLeverage": 10
  }
}
```

### 8.4 Required Response Format

```json
{
  "decision": "BUY | SELL | HOLD",
  "confidence": 0.82,
  "entry": 67430,
  "stop_loss": 66800,
  "take_profit": 68500,
  "reason": "RSI oversold with MACD histogram narrowing, suggesting momentum reversal"
}
```

Validated with Zod:
- `decision`: exactly `"BUY"`, `"SELL"`, or `"HOLD"`
- `confidence`: number 0–1
- `entry`, `stop_loss`, `take_profit`: positive numbers
- `reason`: non-empty string

### 8.5 Failure Handling

| Failure | Behavior |
|---------|----------|
| JSON parse error | Treat as HOLD, confidence 0, log `AI_PARSE_ERROR` |
| Zod validation fails | Treat as HOLD, confidence 0, log `AI_VALIDATION_ERROR` |
| API timeout (>30s) | Treat as HOLD, log `AI_TIMEOUT` |
| API error (rate limit, 500) | Treat as HOLD, log `AI_API_ERROR` |
| `decision === "HOLD"` | Skip risk engine, no trade, log decision |

### 8.6 Guardrails

- AI response never directly triggers execution — always flows through Risk Engine
- AI cannot override risk rules (even confidence 0.99 is rejected if daily loss limit hit)
- Each AI decision snapshot stored on trade record for full auditability

---

## 9. Trading Engine

### 9.1 Core Loop

The `TradeEngine` is a singleton class orchestrating the full pipeline.

```
start(symbol) called
  → decrypt exchange keys
  → initialize exchange service
  → connect WebSocket ticker stream
  → begin 8-second analysis loop:

    [1] Check safety gates (frozen? daily loss? consecutive losses?)
    [2] Read price buffer → compute RSI (14) + MACD (12/26/9)
    [3] Fetch portfolio balance from exchange
    [4] Fetch open positions from exchange
    [5] Check open position SL/TP → close if triggered
    [6] Build structured prompt → call Claude API
    [7] If decision is HOLD → log → skip to next cycle
    [8] Pass decision to Risk Engine (all 8 guardrails)
    [9] If rejected → log rejection with reason → skip
    [10] Calculate position size from risk % and stop-loss distance
    [11] If futures → set leverage on exchange
    [12] Execute market order on exchange
    [13] Record trade in MongoDB (status: OPEN, source: AI)
    [14] Emit stream:trade-executed to renderer
    [15] Update safety state (consecutive wins/losses, peak balance)
```

### 9.2 Position Management

- **Entry:** Record trade as `OPEN` in MongoDB with `aiDecision` and `riskCheck` snapshots
- **Monitoring:** Each cycle checks open positions against AI's `stop_loss` and `take_profit`
- **Exit:** When SL/TP triggered, execute market close → update trade with `exitPrice`, `pnl`, `closedAt` → mark `CLOSED`
- **Position size:** `(portfolio.totalBalance * riskProfile.maxRiskPct / 100) / abs(entry - stop_loss)`

### 9.3 Price Buffer

- Rolling array of 250 price entries from WebSocket ticks
- Minimum 35 bars required before indicators are calculated
- Each entry: `{price: number, timestamp: number}`

---

## 10. Risk Engine

### 10.1 Eight Guardrails

Every trade candidate must pass ALL checks. Any single failure rejects the trade.

| # | Rule | Default | Logic |
|---|------|---------|-------|
| 1 | Max risk per trade | 2% | `positionSize * abs(entry - stopLoss) <= portfolio * maxRiskPct / 100` |
| 2 | Max daily loss | 5% | `sum(today's realized losses) < portfolio * maxDailyLossPct / 100` |
| 3 | Max open positions | 3 | `count(OPEN trades) < maxOpenPositions` |
| 4 | Min confidence | 0.75 | `aiDecision.confidence >= minConfidence` |
| 5 | Volatility filter | 5% | `abs(priceChange1h) < 5%` — reject during extreme moves |
| 6 | Spread filter | 0.5% | `spread < 0.5%` — reject during abnormal spreads |
| 7 | Max leverage | 10x | Futures only: `requestedLeverage <= maxLeverage` |
| 8 | Max drawdown | 15% | `(peakBalance - currentBalance) / peakBalance < 0.15` |

### 10.2 Output

```typescript
interface RiskResult {
  approved: boolean
  passed: string[]     // names of rules that passed
  failed: string[]     // names of rules that failed
  reasons: string[]    // human-readable rejection reasons
}
```

Snapshot stored on every trade record for auditability.

---

## 11. Safety Service

### 11.1 State

```typescript
interface SafetyState {
  frozen: boolean
  frozenReason: string | null        // "KILL_SWITCH" | "CONSECUTIVE_LOSSES" | "DRAWDOWN" | "API_FAILURE"
  consecutiveLosses: number
  peakBalance: number
  emergencyShutdown: boolean
}
```

### 11.2 Triggers

| Trigger | Action |
|---------|--------|
| 3 consecutive losing trades | Set `frozen = true`, `frozenReason = "CONSECUTIVE_LOSSES"` |
| Drawdown exceeds 15% from peak | Set `frozen = true`, close all positions, `frozenReason = "DRAWDOWN"` |
| Exchange API fails 3 times consecutively | Set `frozen = true`, `frozenReason = "API_FAILURE"` |
| Kill switch pressed | Set `frozen = true`, `emergencyShutdown = true`, cancel all orders, close all positions, disable agent in DB |

### 11.3 Recovery

- All freeze states except kill switch: user toggles agent OFF then ON in the UI → clears `frozen`, resets `consecutiveLosses`
- Kill switch: requires explicit re-enable in the agent control panel, which clears `emergencyShutdown`

### 11.4 Persistence

Safety state is written to `electron-store` alongside the session. On app restart, if `frozen = true`, agent starts disabled. User must manually re-enable.

---

## 12. UI / Renderer

### 12.1 Screen Flow

```
IntroPage → AuthPage → DashboardPage
```

No React Router. Screen state managed in Zustand store (`currentScreen` field).

### 12.2 Intro Page

- Full-screen animated landing
- "TradeMAX" branding with primary color `#5A189A`
- Framer Motion entrance animations (fade + scale)
- Two buttons: Login, Register

### 12.3 Auth Page

- Single form that toggles between Login and Register mode
- Fields: name (register only), email, password
- Client-side validation (Zod)
- Calls `window.api.invoke('auth:register' | 'auth:login', data)`
- On success: store user in Zustand, transition to Dashboard

### 12.4 Dashboard Page — Sidebar + Main Area Layout

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────┐ │
│ │          │ │                                   │ │
│ │ TradeMAX │ │     Live Positions Table          │ │
│ │          │ │                                   │ │
│ │──────────│ │                                   │ │
│ │ Agent    │ ├─────────────────────────────────┤ │
│ │ Control  │ │                                   │ │
│ │ (toggle, │ │     Recent Trades Feed            │ │
│ │  symbol, │ │                                   │ │
│ │  kill)   │ │                                   │ │
│ │──────────│ ├─────────────────────────────────┤ │
│ │ Portfolio│ │                                   │ │
│ │ (balance,│ │     Live Logs Stream              │ │
│ │  PnL)    │ │                                   │ │
│ │──────────│ │                                   │ │
│ │ AI Feed  │ │                                   │ │
│ │ (last    │ │                                   │ │
│ │  decision│ │                                   │ │
│ │──────────│ │                                   │ │
│ │ Settings │ │                                   │ │
│ │ (keys,   │ │                                   │ │
│ │  theme)  │ │                                   │ │
│ └──────────┘ └─────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Sidebar (fixed, ~260px):**
1. App branding header
2. Agent Control Panel — ON/OFF toggle, symbol input, spot/futures selector, kill switch button
3. Portfolio Panel — total balance, daily PnL, weekly PnL
4. AI Decision Feed — latest decision, confidence, reasoning
5. Settings — API keys form, theme toggle, exchange selector, logout

**Main Area (scrollable):**
1. Live Positions table — symbol, side, entry, mark price, unrealized PnL, liquidation (futures)
2. Recent Trades feed — symbol, side, PnL, source (AI/manual/system), status, timestamp
3. Live Logs stream — scrolling event feed with level and category badges

### 12.5 Styling System

- **TailwindCSS** with custom theme configuration
- **CSS custom properties** for theme switching via `data-theme="dark|light"` on `<html>`
- **Glassmorphism:** `backdrop-filter: blur(12px)`, semi-transparent backgrounds
- **Colors:** Primary `#5A189A` (purple), Accent `#FFD60A` (yellow)
- **Framer Motion:** page transitions, panel entry stagger, toggle animations, kill switch pulse
- **Kill switch:** permanently visible red button with pulse animation, requires confirmation dialog before executing

### 12.6 Theme System

```css
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
```

### 12.7 Zustand Store Shape

```typescript
interface AppState {
  // Screen
  currentScreen: "intro" | "auth" | "dashboard"
  authMode: "login" | "register"

  // User
  user: { userId: string; name: string; email: string } | null
  settings: UserSettings | null

  // Theme
  theme: "dark" | "light"

  // Trading data (populated via IPC streams)
  portfolio: PortfolioSnapshot | null
  positions: Position[]
  trades: Trade[]
  lastAIDecision: AIDecision | null
  agentStatus: { running: boolean; frozen: boolean; reason?: string }
  logs: LogEntry[]
  marketTick: { symbol: string; price: number; timestamp: number } | null

  // Actions
  setScreen(screen: AppState["currentScreen"]): void
  setUser(user: AppState["user"]): void
  setSettings(settings: UserSettings): void
  toggleTheme(): void
  // ... stream update actions
}
```

### 12.8 Component–IPC Mapping

| Component | Invokes | Subscribes To |
|-----------|---------|---------------|
| AuthPage | `auth:register`, `auth:login` | — |
| DashboardPage | `portfolio:get`, `positions:get`, `trades:history` | — |
| AgentControlPanel | `agent:start`, `agent:stop`, `agent:kill-switch` | `stream:agent-status` |
| PortfolioPanel | — | `stream:portfolio`, `stream:market-tick` |
| PositionsPanel | — | `stream:positions` |
| TradesPanel | — | `stream:trade-executed` |
| AIDecisionFeed | `ai:last-decision` | `stream:ai-decision` |
| LiveLogPanel | `logs:recent` | `stream:log` |
| APIKeysPanel | `settings:save-api-keys`, `settings:get` | — |

---

## 13. Real-Time Features

### 13.1 WebSocket Market Data

- Exchange WebSocket connects when agent starts
- Ticker stream pushes price ticks to main process
- Main process buffers 250 ticks and forwards latest to renderer via `stream:market-tick`

### 13.2 Event Streaming Pattern

All streams use the same pattern:

```typescript
// Main process (ipc.ts)
logger.on('log', (entry) => {
  mainWindow.webContents.send('stream:log', entry)
})

// Preload (index.ts)
on(event: string, callback: (data: unknown) => void): () => void {
  const handler = (_event: IpcRendererEvent, data: unknown) => callback(data)
  ipcRenderer.on(event, handler)
  return () => ipcRenderer.removeListener(event, handler)  // unsubscribe
}

// Renderer (component)
useEffect(() => {
  const unsub = window.api.on('stream:log', (entry) => {
    useAppStore.getState().addLog(entry)
  })
  return unsub
}, [])
```

### 13.3 Stream Lifecycle

- Streams activate when agent starts (except `stream:log` which is always active)
- Streams deactivate when agent stops or user logs out
- Renderer unsubscribes on component unmount via returned cleanup function

---

## 14. Environment Configuration

### 14.1 `.env` File

```env
# App
NODE_ENV=development
JWT_SECRET=replace_with_64_char_random_hex
APP_MASTER_KEY=replace_with_64_char_random_hex

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Claude AI
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# Defaults
DEFAULT_SYMBOL=BTCUSDT
```

### 14.2 Electron Config

```typescript
// BrowserWindow
{
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join(__dirname, '../preload/index.js')
  }
}
```

---

## 15. Build & Development

### 15.1 Dev Mode

```bash
npm run dev
# Runs concurrently:
#   vite (renderer dev server on :5173)
#   tsc --watch (main process)
#   tsc --watch (preload)
#   electron . (waits for vite + compiled JS)
```

### 15.2 Production Build

```bash
npm run build          # Compile all targets
npx electron-builder   # Package as .dmg for macOS
```

### 15.3 Dependencies

**Runtime:** electron, react, react-dom, mongoose, @anthropic-ai/sdk, bcrypt, jsonwebtoken, electron-store, ws, bybit-api, axios, zustand, framer-motion, tailwindcss, technicalindicators, zod, clsx, tailwind-merge, dotenv

**Dev:** typescript, vite, @vitejs/plugin-react, concurrently, cross-env, nodemon, wait-on, electron-builder, postcss, autoprefixer

---

## 16. Non-Functional Requirements

- **Latency:** Trade execution within 2 seconds of risk approval
- **Memory:** Under 300MB RAM in idle, under 500MB during active trading
- **Reliability:** Auto-reconnect WebSockets, persist safety state across restarts
- **Auditability:** Every AI decision, risk check, trade, and safety event logged to MongoDB
- **Security:** Zero secrets in renderer, all encryption in main process, no remote module
