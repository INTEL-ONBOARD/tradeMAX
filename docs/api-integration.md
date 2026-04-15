# Exchange and Claude API Integration Guide

## Binance
- Supports spot and futures endpoints.
- Uses HMAC SHA256 signed requests.
- Live ticker uses Binance trade stream websocket.

### Required permissions
- Spot/Futures trading permissions as needed
- Read balances and positions

### Notes
- Keep API key and secret in user settings; app encrypts at rest.
- Start with reduced leverage and strict risk caps.

## Bybit
- Uses `bybit-api` SDK for REST and websocket access.
- Supports unified account balance lookup and linear futures positions.

### Required permissions
- Read wallet/position data
- Spot/futures trade execution permissions

## Claude
- Uses `@anthropic-ai/sdk` in Electron main process only.
- AI response must be strict JSON with deterministic keys.
- Invalid payloads are rejected and logged.

## Security Boundaries
- Renderer never receives exchange secrets.
- Main process stores encrypted secret blobs in MongoDB.
- Trade execution occurs only after risk engine approval.

## Suggested production hardening
- Add nonce replay checks and request idempotency keys.
- Add exchange retry policy with circuit breaker.
- Add separate paper-trading mode before live deploy.
