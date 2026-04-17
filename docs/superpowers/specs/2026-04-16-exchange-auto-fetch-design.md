# Exchange Auto-Fetch: Validate Keys & Show Wallet Data

**Date:** 2026-04-16
**Approach:** Validate-on-Save (Approach A)

## Problem

After adding Binance or Bybit API keys, the app does not fetch or display wallet balance, positions, or any account info. The `PORTFOLIO_GET` and `POSITIONS_GET` IPC handlers are stubs returning `null` and `[]`. Balance data only flows when the trading agent is running.

## Goal

1. Validate API keys against the exchange before saving them
2. Return wallet balance immediately on successful key save
3. Show balance/positions on dashboard load even when the agent is not running
4. Surface clear error messages when keys are invalid

## Design

### Backend: IPC Handler Changes

#### `SETTINGS_SAVE_API_KEYS` — Validate before saving

Current flow: encrypt keys → save to DB → return `UserSettings`.

New flow:
1. Receive `{ exchange, apiKey, apiSecret }` from frontend
2. Get user doc to determine `tradingMode` and `encryptionSalt`
3. Create a temporary exchange service instance via `createExchangeService(exchange)`
4. Call `exchange.initialize()` with the raw (unencrypted) keys and user's `tradingMode`
5. Call `exchange.getBalance()` as a validation probe
6. **Success:** encrypt keys, save to DB via `auth.saveApiKeys()`, return `{ settings: UserSettings, portfolio: PortfolioSnapshot }`
7. **Failure:** throw a mapped error message (see Error Handling below). Keys are NOT saved.
8. Always call `exchange.destroy()` in a `finally` block

Return type changes from `UserSettings` to `{ settings: UserSettings; portfolio: PortfolioSnapshot }`.

#### `PORTFOLIO_GET` — Wire up the stub

Current: returns `null`.

New implementation:
1. Guard: `if (!currentUserId) throw`
2. Fetch user doc via `auth.getUserDoc(currentUserId)`
3. Determine `selectedExchange`, get encrypted keys
4. If no keys configured, return `null`
5. Decrypt keys using user's `encryptionSalt`
6. Create exchange service, `initialize()`, call `getBalance()`
7. `destroy()` exchange instance in `finally`
8. Return `PortfolioSnapshot`

#### `POSITIONS_GET` — Wire up the stub

Current: returns `[]`.

Same decrypt-create-fetch-destroy pattern as `PORTFOLIO_GET` but calls `getOpenPositions()`.

### Frontend: Settings Modal

#### `ExchangeKeyRow` component changes

New state:
- `saving: boolean` — shows "Validating..." spinner
- `error: string | null` — shows inline error message

Updated `handleSave`:
1. Set `saving = true`, `error = null`
2. Call `SETTINGS_SAVE_API_KEYS`
3. **Success:** update `settings` in store, update `portfolio` in store from response, show "Validated" checkmark, clear key inputs
4. **Failure:** set `error` to the error message, keep key inputs populated so user can fix and retry
5. Set `saving = false` in `finally`

UI changes:
- Save button text: "Save" → "Validating..." (with spinner) → "Validated" (with checkmark)
- Error: red text below the save button row showing the error message
- Error clears when user starts typing again

### Frontend: Auto-fetch on Dashboard Load

In `App.tsx`, inside the `session:restored` handler (after setting user/settings/screen):
1. Check if `settings.hasBinanceKeys || settings.hasBybitKeys`
2. If yes, call `PORTFOLIO_GET` and `POSITIONS_GET` in parallel
3. On success, update store via `setPortfolio()` and `setPositions()`
4. On failure, silently ignore — portfolio stays `null`, panel shows `$0.00`

### Error Handling

#### Exchange error mapping

Errors from exchange API calls during validation are mapped to user-friendly messages:

| Error Type | Detection | User Message |
|---|---|---|
| Invalid credentials | Binance `-2014`/`-2015`, Bybit `10003`/`10004` | "Invalid API key or secret" |
| Permission denied | Binance "not allowed" in message, Bybit `10010` | "API key lacks required permissions. Enable 'Read' access." |
| Network/timeout | `ECONNREFUSED`, `ETIMEDOUT`, axios timeout | "Could not connect to exchange. Check your internet connection." |
| Other | Catch-all | "Failed to validate keys: <original message>" |

#### Error surfaces

- **Settings modal:** inline red text below the API key form. No toasts.
- **Startup fetch:** silent failure. Logged via `logger.warn()`.

### Files Modified

| File | Change |
|---|---|
| `src/main/ipc.ts` | Rewrite `SETTINGS_SAVE_API_KEYS` handler (validate-before-save), implement `PORTFOLIO_GET` and `POSITIONS_GET` |
| `src/renderer/components/SettingsModal.tsx` | Add validation states (loading/error) to `ExchangeKeyRow`, handle new response shape |
| `src/renderer/App.tsx` | Add portfolio/positions fetch on `session:restored` |

### Files NOT Modified

- Exchange services (`binanceService.ts`, `bybitService.ts`) — already fully implemented
- Store (`appStore.ts`) — already has `setPortfolio` and `setPositions`
- Preload (`index.ts`) — `portfolio:get` and `positions:get` already in the allowlist
- Types (`types.ts`) — `PortfolioSnapshot` and `Position` already defined
- Constants (`constants.ts`) — `IPC.PORTFOLIO_GET` and `IPC.POSITIONS_GET` already defined

### What This Does NOT Include

- Multi-asset balance (only USDT counted) — existing limitation, out of scope
- Account info endpoint (fees, leverage settings) — not needed for this feature
- Periodic background polling — agent streaming already handles live updates
- WebSocket-based balance updates — overkill for this use case
