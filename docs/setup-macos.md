# TradeMAX Setup on macOS

## 1. Prerequisites
- macOS 13+
- Node.js 20+
- npm 10+
- MongoDB 7+ (local or Atlas)

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

```bash
cp .env.example .env
```

Set values for:
- JWT_SECRET
- APP_MASTER_KEY
- MONGO_URI
- CLAUDE_API_KEY

## 4. Start development

```bash
npm run dev
```

This starts:
- Vite renderer on localhost:5173
- TypeScript watch for main/preload
- Electron runtime with secure preload bridge

## 5. Production build

```bash
npm run build
npm start
```

## 6. Package for macOS

```bash
npx electron-builder --mac
```

The packaged app is generated under `dist`.

## 7. Operational checklist
- Verify Agent Mode defaults to OFF for new users.
- Test kill switch in paper/sandbox environment first.
- Confirm risk profile values before enabling live mode.
- Confirm API keys are encrypted in MongoDB documents.
- Review logs collection for full audit trail.
