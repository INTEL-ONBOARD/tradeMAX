# TradeMAX Current System Brief

Last reviewed against code on 2026-04-19.

This document describes the current implementation, not the historical design intent. Where older docs differ, the codebase is the source of truth.

## 1. System Purpose

TradeMAX is an Electron desktop application for crypto trading operations. It combines:

- user authentication
- encrypted storage of exchange and AI credentials
- live Bybit account and market data streaming
- AI-assisted trade decisioning via OpenAI
- rule-based risk validation
- hard safety controls
- trade, log, and configuration persistence

The app is packaged as a single desktop product. There is no separate web backend or remote application server maintained by this repo.

## 2. Runtime Architecture

TradeMAX uses Electron's standard split:

- main process: privileged runtime, effectively the backend
- preload: restricted IPC bridge
- renderer: React UI

### Main process responsibilities

Implemented primarily in `src/main/` and `src/services/`.

- boot Electron and connect to MongoDB
- register IPC handlers
- manage auth, session restore, and local session persistence
- decrypt credentials in memory when needed
- validate and save Bybit / OpenAI credentials
- run the account watcher when the agent is idle
- run the trade engine when the agent is active
- persist logs, trades, and config snapshots
- emit live stream events back to the renderer

Entry point: `src/main/main.ts`

### Preload responsibilities

Implemented in `src/preload/index.ts`.

- expose `window.api.invoke(channel, data?)`
- expose `window.api.on(event, callback)`
- enforce an allowlist of IPC invoke channels and stream events

This is the only bridge between renderer and main.

### Renderer responsibilities

Implemented in `src/renderer/`.

- render intro, auth, and dashboard flows
- keep client UI state in Zustand
- invoke main-process actions over IPC
- subscribe to live streams and mirror them into the UI
- never access secrets directly

Root app: `src/renderer/App.tsx`

## 3. Technology Stack

- Electron 34
- React 18
- Zustand
- Vite
- Tailwind CSS
- Framer Motion
- Node.js / TypeScript
- MongoDB with Mongoose
- Bybit via `bybit-api`
- OpenAI via `openai`
- `technicalindicators` for indicator calculations
- `electron-store` for local session and safety persistence

## 4. Major Subsystems

### Authentication and session

Files:

- `src/services/authService.ts`
- `src/main/sessionManager.ts`
- `src/db/models/User.ts`

Behavior:

- register/login validated with Zod
- passwords hashed with bcrypt
- JWT signed with `JWT_SECRET`
- token persisted locally with `electron-store`
- session restore performed on app startup through `auth:session`
- login rate limiting is kept in process memory

Important note:

- logout now routes through `auth:logout`, which stops the watcher/engine, clears cached keys, and resets the persisted session correctly

### Secrets and encryption

Files:

- `src/services/encryptionService.ts`
- `src/services/authService.ts`

Behavior:

- exchange and OpenAI keys are encrypted with AES-256-GCM
- encryption key is derived from `APP_MASTER_KEY`
- each user gets a dedicated random salt
- secrets are decrypted only in main-process flows

### IPC surface

Files:

- `src/main/ipc.ts`
- `src/shared/constants.ts`
- `src/preload/index.ts`

Main invoke groups:

- auth
- settings and key management
- portfolio / positions / trade history
- AI model listing
- agent control
- exchange pair discovery
- backtesting
- recent logs

Stream groups:

- market ticks
- portfolio snapshots
- positions
- executed trades
- AI decisions
- agent status
- log events
- in-app notifications
- backtest progress

### Account watcher

Files:

- `src/main/accountWatcher.ts`
- `src/services/bybitService.ts`

Purpose:

- run when the trading agent is not active
- stream portfolio, open positions, and ticker updates into the UI

Behavior:

- fetch initial state by REST
- start Bybit private account WebSocket when live mode is selected
- start market ticker WebSocket for the active symbol in both live and paper mode
- reuse shared paper state so simulated balances and positions survive watcher/engine handoff

### Trading engine

Files:

- `src/services/tradeEngine.ts`
- `src/services/aiPipelineService.ts`
- `src/services/marketSnapshotService.ts`
- `src/services/safetyService.ts`

Purpose:

- own the autonomous trading loop while the agent is running

Behavior:

- load user settings and decrypt required keys
- initialize the selected exchange service
- stream live ticks and maintain the latest market price
- build a normalized market snapshot each cycle
- run the staged AI pipeline:
  - Market Analyst
  - Trade Architect
  - Execution Critic
  - Post-Trade Reviewer
- run idle/operator-triggered self-review passes when review mode is enabled and local history has new signal
- enforce only emergency floors in code
- place the order when the pipeline returns a contract-valid, exchange-safe trade
- persist the cycle, trade, review, and self-review artifacts locally
- emit updates and notifications

### Risk engine

File:

- `src/services/riskEngine.ts`

Current rules:

- max risk per trade
- max daily loss
- max open positions
- min AI confidence
- volatility filter
- spread filter
- slippage guard
- max leverage
- max drawdown

Important implementation detail:

- the leverage rule now rejects futures leverage above the hard `20x` limit, and the validator/tests match that runtime behavior

### Safety service

File:

- `src/services/safetyService.ts`

Current freeze triggers:

- kill switch
- consecutive losses
- drawdown breach
- exchange API failure threshold

Persisted locally:

- frozen state
- frozen reason
- consecutive loss count
- peak balance
- emergency shutdown flag

### Backtesting

Files:

- `src/services/backtestService.ts`
- `src/main/ipc.ts`

Behavior:

- fetch historical Bybit candles over REST
- build the same normalized snapshot schema used live
- replay the staged AI pipeline with profile-aware context windows
- support standard replay and walk-forward sweeps
- emit progress updates over IPC

Current product state:

- backend support exists
- renderer now includes a launch workflow, progress UI, and results modal in the dashboard tools view
- renderer settings now include saved profile presets for tempo-specific engine configs

## 5. Exchange Layer

### Active exchanges in code

Current supported exchange services:

- Bybit
- paper

Factory:

- `src/services/exchangeFactory.ts`

Bybit service responsibilities:

- initialize REST and WebSocket clients
- fetch balances
- fetch positions
- fetch closed PnL
- place and close market orders
- cancel open orders
- set leverage
- fetch spread
- fetch available symbols
- stream account and ticker updates

Paper service responsibilities:

- simulate balance and position changes
- simulate fills using live ticker prices from Bybit public data

Current state of paper mode:

- backend service exists
- user model and validators support `paper`
- renderer now exposes paper vs Bybit venue selection, paper starting balance controls, and idle paper portfolio/position fetching

## 6. Data Model

### User

File:

- `src/db/models/User.ts`

Stores:

- profile fields
- bcrypt password hash
- user encryption salt
- encrypted Bybit keys
- encrypted OpenAI key
- selected exchange
- trading mode
- risk profile
- engine configuration
- agent mode flag
- theme preference

### Trade

File:

- `src/db/models/Trade.ts`

Stores:

- symbol, side, type
- entry / exit prices
- quantity
- pnl
- open or closed status
- exchange and mode
- AI decision snapshot
- risk result snapshot
- timestamps

### Decision journal

File:

- `src/db/models/DecisionJournal.ts`

Stores:

- symbol, tempo profile, regime, and volatility bucket
- full staged AI pipeline payload
- execution result metadata
- post-trade review payload
- local references to the associated market snapshot

### Market snapshot

File:

- `src/db/models/MarketSnapshot.ts`

Stores:

- normalized market snapshot payload
- symbol and tempo profile
- local timestamp for replay and memory retrieval

### Memory note

File:

- `src/db/models/MemoryNote.ts`

Stores:

- short local lessons and heuristics from post-trade review
- tags for regime, volatility, and outcome
- priority for retrieval ranking

### Profile config

File:

- `src/db/models/ProfileConfig.ts`

Stores:

- named local presets for tempo/profile-specific configuration
- serialized profile config payload
- user-owned profile metadata

### Log

File:

- `src/db/models/Log.ts`
