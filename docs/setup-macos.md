# TradeMAX v2 — macOS Setup Guide

## Prerequisites

- macOS 13 Ventura or later
- Node.js 20 or later (`node --version` to verify)
- A MongoDB Atlas account with a cluster created
- An OpenAI API key

---

## 1. Install Dependencies

```bash
npm install
```

This installs all Electron, React, and service dependencies listed in `package.json`.

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in each value:

```env
# App
NODE_ENV=development
JWT_SECRET=<64 random hex chars>
APP_MASTER_KEY=<64 random hex chars>

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# OpenAI
OPENAI_API_KEY=sk-proj-<your-key>
OPENAI_MODEL=gpt-5.4-mini

# Defaults
DEFAULT_SYMBOL=BTCUSDT
```

**JWT_SECRET** — Used to sign session tokens. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**APP_MASTER_KEY** — Used for AES-256-GCM encryption of exchange API keys. Generate the same way. Store it securely — losing it means encrypted API keys cannot be decrypted.

**MONGODB_URI** — Copy the connection string from MongoDB Atlas (Clusters → Connect → Drivers). Replace `<user>` and `<pass>` with your database user credentials.

**OPENAI_API_KEY** — From the [OpenAI API keys page](https://platform.openai.com/api-keys). The app calls OpenAI only from the main process; the key is never exposed to the renderer.

---

## 3. Run in Development

```bash
npm run dev
```

This starts four concurrent processes:
- Vite renderer dev server on `http://localhost:5173`
- TypeScript watch compiler for main process
- TypeScript watch compiler for preload script
- Electron (launched after renderer and compiled files are ready)

---

## 4. Production Build

```bash
npm run build
```

Build order:
1. `vite build` — renderer bundle to `dist/renderer/`
2. `tsc -p tsconfig.main.json` — main process to `dist/main/`
3. `tsc -p tsconfig.preload.json` — preload script to `dist/preload/`

To package as a macOS `.dmg`:
```bash
npx electron-builder --mac
```

Output is in the `dist/` directory.

---

## 5. Operational Checklist

Before enabling live trading, verify each of the following:

- [ ] **Agent mode defaults to OFF** — New accounts have `agentModeEnabled: false`. Confirm this in the Agent Control Panel before entering API keys.
- [ ] **Test the kill switch** — Start the agent on a testnet or paper account, then press Kill Switch. Verify the engine stops and the freeze indicator appears.
- [ ] **Verify API key encryption** — After saving API keys, inspect the MongoDB `users` document. The `encryptedApiKeys` fields should be opaque encrypted strings, never plaintext.
- [ ] **Confirm risk profile** — Review `maxRiskPct`, `maxDailyLossPct`, and `maxOpenPositions` in Settings before enabling agent mode on live funds. Defaults are conservative (2% / 5% / 3 positions / 10x max leverage).
- [ ] **Check draw-down baseline** — The safety service initialises `peakBalance` at 0. Start the agent briefly with agent mode OFF so the portfolio snapshot establishes a real peak baseline before enabling live execution.
- [ ] **Review logs** — Open the Live Log Panel after startup to confirm MongoDB connection, session restore, and any startup warnings are as expected.
