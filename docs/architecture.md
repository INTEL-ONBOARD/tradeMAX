# TradeMAX Architecture and Implementation Blueprint

## Overview
TradeMAX is a desktop autonomous crypto trading system built with Electron, React, Node.js, and MongoDB.
The application is designed around hard safety controls so autonomous trading can never bypass risk management or operator overrides.

## Core Principles
1. Safety before execution: no trade can execute before passing risk validation.
2. AI is advisory: Claude proposes actions, the system validates and decides.
3. Secrets isolation: API keys and secrets are encrypted in backend services and never exposed to the renderer.
4. Operator sovereignty: emergency kill switch can stop all trading activity immediately.
5. Auditability: all decisions, rejections, and executions are logged.

## Technology Stack
- Electron: desktop shell and privileged backend runtime
- React + TailwindCSS + Framer Motion: renderer UI
- Node.js services in Electron main process
- MongoDB + Mongoose
- Binance and Bybit REST/WebSocket integrations
- Claude API for structured trade decisions

## Folder Structure

```text
/src
  /main
    main.ts
    ipc.ts
    sessionManager.ts
  /preload
    index.ts
  /renderer
    index.html
    main.tsx
    App.tsx
    /components
    /pages
    /store
    /styles
  /services
    authService.ts
    aiService.ts
    binanceService.ts
    bybitService.ts
    marketDataService.ts
    positionService.ts
    executionService.ts
    tradeEngine.ts
    riskEngine.ts
    safetyService.ts
    encryptionService.ts
    loggerService.ts
  /db
    mongoConnection.ts
    /models
      User.ts
      Trade.ts
      Log.ts
  /shared
    types.ts
    constants.ts
    validators.ts
```

## Security Architecture
- Electron BrowserWindow configured with:
  - contextIsolation: true
  - nodeIntegration: false
  - sandbox: true
- Renderer cannot access Node APIs directly.
- Preload script exposes a minimal, allowlisted IPC bridge.
- API keys encrypted with AES-256-GCM before persistence.
- Passwords hashed with bcrypt.
- No secret values are returned to renderer responses.
- Session token kept in main process only.

## Data Model

### users collection
- name
- email (unique)
- passwordHash
- encryptedApiKeys.binance
- encryptedApiKeys.bybit
- tradingMode (spot/futures)
- riskProfile
- agentModeEnabled
- themePreference
- createdAt, updatedAt

### trades collection
- userId
- exchange (binance/bybit)
- symbol
- side
- orderType
- quantity
- entry
- exit
- pnl
- source (ai/manual/system)
- status
- metadata
- timestamps

### logs collection
- userId
- level
- category
- message
- context
- createdAt

## Trading Lifecycle

```text
Market Data -> AI Decision -> Risk Engine -> Approval Gate -> Execution Engine -> Position Update -> Audit Logging
```

### Guardrails in pipeline
1. AI generates a strict JSON decision.
2. JSON is validated against schema.
3. Risk engine evaluates:
   - max risk per trade
   - daily loss cap
   - max open positions
   - confidence threshold
   - volatility guard
   - spread guard
4. If any check fails, trade is rejected and logged.
5. If checks pass and agent mode is ON, order is submitted.

## Agent Mode Controls
- OFF: AI analysis only, no execution.
- ON: AI proposals can execute only after risk approval.
- Emergency Kill Switch:
  - close all open positions
  - cancel all pending orders
  - stop trading loops
  - set agent mode OFF
  - requires manual re-enable by user

## Safety Systems
- Auto-disable agent after 3 consecutive losing closed trades.
- Max drawdown threshold protection.
- API failure detector to freeze trading if exchange reliability degrades.
- Emergency shutdown mode state in memory and database.
- Full decision and action audit logs.

## IPC Surface (Preload Bridge)
- auth:
  - register
  - login
  - logout
  - getSession
- settings:
  - updateRiskProfile
  - updateTheme
  - setTradingMode
  - setAgentMode
- trading:
  - getPortfolio
  - getPositions
  - getTrades
  - startAgent
  - stopAgent
  - killSwitch
- stream:
  - subscribeMarketData
  - subscribeTradeLogs
  - subscribeAIDecisions

## Claude Integration Contract
Input payload includes:
- market snapshots
- indicator set (RSI, MACD, volume)
- portfolio summary
- open positions

Output must be strict JSON:

```json
{
  "decision": "BUY | SELL | HOLD",
  "confidence": 0.0,
  "entry": 0.0,
  "stop_loss": 0.0,
  "take_profit": 0.0,
  "reason": "short explanation"
}
```

Invalid JSON or missing keys causes a rejected decision and log event.

## UI Composition
- Intro screen with animated branding.
- Auth pages for login/register.
- Dashboard sections:
  - Portfolio panel
  - Live positions panel
  - Recent trades panel
  - AI decision feed
  - Agent ON/OFF toggle
  - Emergency kill switch button
- Theme support:
  - dark/light mode
  - primary #5A189A
  - accent #FFD60A

## Deployment and Runtime Notes (macOS)
- Development:
  - Vite dev server for renderer
  - Electron main process via tsx
- Production:
  - electron-builder package for macOS
- Environment variables managed via .env in main process only.

## Non-Bypassable Rule
All execution entry points must call `riskEngine.validateTrade(...)`.
No service is allowed to submit orders directly from renderer requests.
