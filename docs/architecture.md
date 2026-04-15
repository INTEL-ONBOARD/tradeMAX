# TradeMAX v2 — Architecture Reference

## System Purpose

TradeMAX is an autonomous crypto trading desktop application built on Electron. It connects to Binance or Bybit, streams live market data, runs RSI/MACD indicators, requests AI trade decisions from Claude, validates those decisions through a risk engine, and executes orders — all within a single secured desktop process. Hard safety controls (kill switch, 3-loss freeze, drawdown protection) are non-bypassable by design.

---

## Architecture: Monolithic Main + Thin Renderer

TradeMAX uses a strict two-process split:

- **Main process** — Electron's Node.js runtime. Owns all privileged work: MongoDB connection, exchange REST/WebSocket calls, Claude API calls, authentication, encryption, risk validation, trade execution, and logging.
- **Renderer process** — React SPA running in Chromium. Stateless view layer. Communicates exclusively via IPC through the preload bridge. Has no direct access to Node APIs, the filesystem, or secrets.

The preload script (`src/preload/index.ts`) is the only bridge between processes. It exposes a minimal, allowlisted `window.api` surface using `contextBridge`.

---

## Security Model

| Control | Detail |
|---|---|
| `contextIsolation` | `true` — renderer cannot access the main process context |
| `nodeIntegration` | `false` — Node APIs unavailable in renderer |
| `sandbox` | `true` — additional OS-level isolation |
| API key encryption | AES-256-GCM via `encryptionService.ts`, keyed from `APP_MASTER_KEY` |
| Password storage | bcrypt hashed in MongoDB |
| JWT | Generated and validated in main process only; never sent to renderer in raw form |
| Exchange secrets | Encrypted blobs stored in MongoDB `users` collection; decrypted in memory only during active engine loop |
| Renderer responses | No secret values are included in any IPC response |

---

## Folder Structure

```text
src/
  main/
    main.ts            — Electron app entry, window creation, MongoDB init
    ipc.ts             — All ipcMain.handle registrations
    sessionManager.ts  — JWT persistence and safety state (electron-store)
  preload/
    index.ts           — contextBridge: exposes window.api to renderer
  renderer/
    index.html
    main.tsx           — React root
    App.tsx            — Router: IntroPage → AuthPage → DashboardPage
    components/
      AIDecisionFeed.tsx
      APIKeysPanel.tsx
      AgentControlPanel.tsx
      GlassCard.tsx
      LiveLogPanel.tsx
      PortfolioPanel.tsx
      PositionsPanel.tsx
      Sidebar.tsx
      TradesPanel.tsx
    pages/
      AuthPage.tsx
      DashboardPage.tsx
      IntroPage.tsx
    store/
      appStore.ts      — Zustand global state
    styles/
      index.css
    vite-env.d.ts
  services/
    aiService.ts       — Claude API integration, Zod validation, HOLD fallback
    authService.ts     — Register, login, session restore, API key save
    binanceService.ts  — Binance REST + WebSocket (HMAC-SHA256)
    bybitService.ts    — Bybit via bybit-api SDK v5
    encryptionService.ts — AES-256-GCM encrypt/decrypt
    exchangeFactory.ts — Factory: returns BinanceService or BybitService
    loggerService.ts   — MongoDB + EventEmitter log sink
    riskEngine.ts      — Trade validation against risk profile
    safetyService.ts   — Kill switch, freeze logic, drawdown tracking
    tradeEngine.ts     — Main trading loop (Market Data → Indicators → AI → Risk → Execution)
  db/
    mongoConnection.ts — Mongoose connect
    models/
      User.ts
      Trade.ts
      Log.ts
  shared/
    constants.ts       — IPC channel names, engine tuning constants
    types.ts           — Shared TypeScript types
    validators.ts      — Zod schemas for IPC input validation
```

---

## IPC Surface

### Invoke Channels (15)

| Channel | Purpose |
|---|---|
| `auth:register` | Create account, returns session + settings |
| `auth:login` | Authenticate, returns session + settings |
| `auth:logout` | Stop engine, clear session |
| `auth:session` | Check current session (placeholder) |
| `settings:save-api-keys` | Encrypt and persist exchange API keys |
| `settings:get` | Fetch user settings |
| `settings:update` | Update risk profile / preferences |
| `portfolio:get` | Fetch portfolio snapshot |
| `positions:get` | Fetch open positions |
| `trades:history` | Fetch trade history (paginated) |
| `ai:last-decision` | Get most recent AI decision |
| `agent:start` | Start trading engine for given symbol |
| `agent:stop` | Gracefully stop trading engine |
| `agent:kill-switch` | Emergency stop — freeze and halt all trading |
| `logs:recent` | Fetch recent log entries |

### Stream Events (7)

| Event | Payload |
|---|---|
| `stream:market-tick` | Latest price, volume, timestamp |
| `stream:portfolio` | Balance snapshot |
| `stream:positions` | Open positions array |
| `stream:trade-executed` | Trade record after execution |
| `stream:ai-decision` | AI decision object |
| `stream:agent-status` | Running, frozen, freeze reason |
| `stream:log` | Live log entry |

All channel names are defined in `src/shared/constants.ts` (`IPC` and `STREAM` objects). The preload whitelist is derived from `ALLOWED_INVOKE_CHANNELS` and `ALLOWED_STREAM_CHANNELS`.

---

## Database: MongoDB Atlas

Three collections managed via Mongoose:

**`users`** — Account, encrypted API keys, risk profile, agent mode flag, theme preference.

**`trades`** — Full trade record per execution: symbol, side, type, entry/exit price, quantity, PnL, status, source (ai/manual/system), exchange, mode (spot/futures), AI decision snapshot, risk check result, timestamps.

**`logs`** — Structured audit log: level (INFO/WARN/ERROR), category, message, metadata, userId, timestamp.

---

## Trading Pipeline

```
Market Data (WebSocket ticker)
    │
    ▼
Price Buffer (up to 250 bars)
    │
    ▼
Indicators (RSI-14, MACD 12/26/9)
    │
    ▼
AI Decision (Claude — strict JSON contract)
    │
    ▼
Zod Validation (schema enforcement, HOLD fallback on failure)
    │
    ▼
Risk Engine (max risk %, daily loss cap, max positions, min confidence, volatility, spread)
    │
    ▼
Safety Check (frozen? kill switch active?)
    │
    ▼
Order Execution (exchange REST)
    │
    ▼
Position Update + Trade Log (MongoDB)
    │
    ▼
Stream Events (renderer updated via IPC)
```

The engine loop runs every 8 seconds (`ENGINE.LOOP_INTERVAL_MS`). Indicators require a minimum of 35 bars (`ENGINE.MIN_BARS_FOR_INDICATORS`) before any AI call is made.

---

## Safety Systems

| System | Trigger | Effect |
|---|---|---|
| Kill switch | Operator clicks "Kill Switch" | `emergencyShutdown = true`, engine stops, state persisted, requires manual re-enable |
| 3-loss freeze | 3 consecutive closed losing trades | `frozen = true`, reason: `CONSECUTIVE_LOSSES`, agent cannot restart until freeze is cleared |
| Drawdown protection | Portfolio drawdown ≥ 15% from peak | `frozen = true`, reason: `DRAWDOWN` |
| API failure freeze | Exchange API failure threshold reached | `frozen = true`, reason: `API_FAILURE` |

Safety state is persisted via `electron-store` so it survives application restarts. A frozen agent cannot be started from the UI until the operator explicitly clears the freeze. The kill switch sets `emergencyShutdown = true` which requires a manual `resetFreeze()` call; UI exposes this as a confirmation-gated action.

---

## Agent Mode Controls

- **OFF (default)** — AI decisions are computed and displayed but no orders are submitted.
- **ON** — Decisions that pass risk validation are submitted to the exchange.
- **Kill Switch** — Immediately freezes the engine. Sets both `frozen` and `emergencyShutdown`. All streaming stops. No further orders can be placed without operator intervention.

Agent mode state is stored on the User document (`agentModeEnabled`) and in main process memory.

---

## UI Layout

- **Sidebar** — Navigation between panels: Portfolio, Positions, Trades, AI Feed, API Keys, Logs.
- **Main Area** — Active panel content.
- **Agent Control Panel** — Prominent Start/Stop toggle and Kill Switch button with status indicator.

Design: glassmorphism card system (`GlassCard.tsx`), dark/light theme toggle (Zustand), TailwindCSS utility classes with Framer Motion transitions. Default background `#0a0a0f`.
