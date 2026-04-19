# TradeMAX

Autonomous crypto trading desktop application using Electron, React, Node.js, MongoDB, Bybit, and OpenAI with hard safety controls.

## Core Safety Guarantees
- AI cannot execute trades directly.
- Every trade passes the risk engine first.
- Emergency kill switch overrides all loops.
- Agent auto-freezes after safety failures.

## Stack
- Electron (main + preload)
- React + TailwindCSS + Framer Motion
- MongoDB + Mongoose
- Bybit API + WebSocket streams
- OpenAI API

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Package for macOS:

```bash
npm run dist:mac
```

See docs:
- `docs/current-system-brief.md`
- `docs/architecture.md`
- `docs/setup-macos.md`
- `docs/api-integration.md`
