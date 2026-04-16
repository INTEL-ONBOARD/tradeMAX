# Trading Engine Full Fix — All 27+ Issues

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every identified bug, accuracy issue, and missing feature in tradeMAX, and expose all tunable parameters in the Settings UI.

**Architecture:** Layer-by-layer bottom-up: types/constants first, then DB models, services, IPC, and finally frontend. Each layer only depends on layers below it, so tasks within a layer can run in parallel.

**Tech Stack:** TypeScript, Electron, React, Zustand, MongoDB/Mongoose, Zod, Binance REST/WS, Bybit SDK, Claude API, technicalindicators

---

## File Map

### Modified Files
- `src/shared/types.ts` — Add EngineConfig, CandleBar, richer AIPromptData
- `src/shared/constants.ts` — Move hardcoded ENGINE values to defaults, add new config keys
- `src/shared/validators.ts` — Add engineConfigSchema, update settingsUpdateSchema
- `src/db/models/User.ts` — Add engineConfig field, encryptionSalt
- `src/db/models/Trade.ts` — Add compound index
- `src/services/encryptionService.ts` — Per-user salt support
- `src/services/binanceService.ts` — Real spread, WS reconnect fix, rate limiter, multi-asset balance
- `src/services/bybitService.ts` — Fill price query after order, spread fetch
- `src/services/exchangeFactory.ts` — Add getSpread/getOrderFills to interface
- `src/services/aiService.ts` — Retry logic, timeout enforcement, richer context
- `src/services/riskEngine.ts` — Fix MAX_RISK_PER_TRADE rule, accept real spread + quantity
- `src/services/safetyService.ts` — Callback on freeze, loss counter fix
- `src/services/tradeEngine.ts` — Candle aggregation, SL/TP fix, slippage guard, cooldown, available balance, 1h price calc, richer AI prompt
- `src/services/authService.ts` — Handle engineConfig in updateSettings
- `src/main/ipc.ts` — Wire new settings, new IPC channels if needed
- `src/preload/index.ts` — Whitelist new channels if added
- `src/renderer/store/appStore.ts` — No structural changes needed (settings already generic)
- `src/renderer/components/SettingsModal.tsx` — Build full Risk Profile + Engine Config UI
- `src/renderer/components/AgentControlPanel.tsx` — Use configurable symbol from settings

### New Files
- `src/renderer/components/ErrorBoundary.tsx` — React error boundary
- `src/services/candleAggregator.ts` — Tick-to-candle conversion

---

## Task 1: Foundation — Types, Constants, Validators

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/constants.ts`
- Modify: `src/shared/validators.ts`

### New types in types.ts:
- `EngineConfig` — user-configurable engine parameters
- `CandleBar` — OHLCV candle structure
- Richer `AIPromptData` — add EMA, Bollinger, volume, recent trade history, trend context
- Add `getSpread` and `getOrderFills` to exchange interface shape
- Add `RiskContext.quantity` field so MAX_RISK_PER_TRADE can validate actual size

### New constants:
- `ENGINE_DEFAULTS` — default values for all EngineConfig fields
- Keep `ENGINE` as compile-time constants for truly fixed values (IPC channels, etc.)

### New validators:
- `engineConfigSchema` — Zod schema for all engine config fields
- Update `settingsUpdateSchema` to include `engineConfig`

---

## Task 2: DB Models

**Files:**
- Modify: `src/db/models/User.ts`
- Modify: `src/db/models/Trade.ts`

### User model changes:
- Add `engineConfig` subdocument matching EngineConfig type
- Add `encryptionSalt` field (random per-user, generated on register)

### Trade model changes:
- Add compound index on `(userId, status, closedAt)` for daily PnL query
- Add compound index on `(userId, status)` for open trade count

---

## Task 3: Encryption Service

**Files:**
- Modify: `src/services/encryptionService.ts`
- Modify: `src/services/authService.ts`

### Changes:
- Accept optional `salt` parameter in encrypt/decrypt
- On register, generate random 32-byte salt, store in user doc
- On encrypt/decrypt for user data, pass user's salt
- Keep backward-compatible default salt for migration

---

## Task 4: Exchange Services

**Files:**
- Modify: `src/services/binanceService.ts`
- Modify: `src/services/bybitService.ts`
- Modify: `src/services/exchangeFactory.ts`

### Binance fixes:
- Add `getSpread(symbol)` — fetch best bid/ask from `/api/v3/ticker/bookTicker`
- Fix `stopTickerStream()` — set `reconnectAttempts = 0` not max
- Fix `startTickerStream()` — reset reconnectAttempts at start
- Fix `getBalance()` spot mode — sum all assets via `/api/v3/ticker/price` conversion to USDT
- Add simple rate limiter (track request count per minute)

### Bybit fixes:
- Add `getSpread(symbol)` — fetch orderbook top level
- Fix `placeMarketOrder()` — query order fill details after submission to get actual price
- Add `getOrderFills(orderId)` method

### Factory:
- Formalize `ExchangeService` interface with `getSpread` method

---

## Task 5: Candle Aggregator (New)

**Files:**
- Create: `src/services/candleAggregator.ts`

### Purpose:
Convert raw WebSocket ticks into proper OHLCV candles at a configurable interval.

---

## Task 6: AI Service

**Files:**
- Modify: `src/services/aiService.ts`

### Fixes:
- Add retry with exponential backoff (configurable retries, default 2)
- Enforce timeout via AbortController
- Accept richer prompt data (more indicators, recent trades, trend)
- Enhance system prompt with SL/TP contract (SL always worse than entry for the trade direction)
- Log full response on parse failure (not truncated)
- Reset client when API key changes

---

## Task 7: Risk Engine

**Files:**
- Modify: `src/services/riskEngine.ts`

### Fixes:
- Fix MAX_RISK_PER_TRADE: accept `quantity` in context, compare against maxQuantity, fail if exceeded
- Spread filter now uses real spread from exchange
- Add slippage rule: reject if expected slippage > threshold

---

## Task 8: Safety Service

**Files:**
- Modify: `src/services/safetyService.ts`

### Fixes:
- Add `onFreeze` callback so trade engine can notify UI immediately
- Use configurable MAX_CONSECUTIVE_LOSSES and MAX_DRAWDOWN_PCT from user settings
- Fix loss counter: reset on unfreeze, not just on win

---

## Task 9: Trade Engine (Biggest Changes)

**Files:**
- Modify: `src/services/tradeEngine.ts`

### Fixes:
1. **SL/TP logic** — Enforce contract: for BUY, SL < entry < TP; for SELL, TP < entry < SL. Validate AI output matches this before using it.
2. **Use candle aggregator** instead of raw tick buffer for indicators
3. **Position sizing** — Use `availableBalance` not `totalBalance`
4. **Slippage guard** — After order fill, check fill price vs expected; if slippage > threshold, log warning
5. **Real spread** — Fetch from exchange via `getSpread()`, pass to risk engine
6. **1h price change** — Calculate from candles with proper time window, not buffer index 0
7. **Trade cooldown** — Track last trade timestamp, skip if within cooldown period
8. **Richer AI prompt** — Include EMA, Bollinger, recent trade outcomes, candle data
9. **Use engine config from user doc** — Loop interval, indicator timeframe, cooldowns, etc.
10. **Daily PnL caching** — Cache daily PnL and refresh every N cycles instead of every cycle

---

## Task 10: IPC + Auth Backend

**Files:**
- Modify: `src/services/authService.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

### Changes:
- Handle `engineConfig` in `updateSettings`
- Generate `encryptionSalt` on register
- Pass engine config to trade engine on start

---

## Task 11: Frontend — Settings UI + Error Boundary

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`
- Create: `src/renderer/components/ErrorBoundary.tsx`
- Modify: `src/renderer/components/AgentControlPanel.tsx`
- Modify: `src/renderer/App.tsx`

### Settings UI — Risk Profile tab (was placeholder):
Build complete form for all risk + engine parameters:
- Max Risk Per Trade %
- Max Daily Loss %
- Max Open Positions
- Min AI Confidence
- Max Leverage
- Trading Symbol
- Loop Interval (seconds)
- Candle Timeframe (1m/5m/15m)
- Max Slippage %
- Trade Cooldown (seconds)
- AI Retry Count
- Max Consecutive Losses
- Max Drawdown %
- Volatility Threshold %

### Error Boundary:
- Wrap App in ErrorBoundary component
- Show recovery UI on crash

### AgentControlPanel:
- Use symbol from settings instead of hardcoded "BTCUSDT"
