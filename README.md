# TradeMAX

Autonomous crypto trading desktop application using Electron, React, Node.js, MongoDB, Binance/Bybit, and Claude AI with hard safety controls.

## Core Safety Guarantees
- AI cannot execute trades directly.
- Every trade passes the risk engine first.
- Emergency kill switch overrides all loops.
- Agent auto-freezes after safety failures.

## Stack
- Electron (main + preload)
- React + TailwindCSS + Framer Motion
- MongoDB + Mongoose
- Binance API + Bybit API + WebSocket streams
- Claude API

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

See docs:
- `docs/architecture.md`
- `docs/setup-macos.md`
- `docs/api-integration.md`
