# TradeMAX v2 — API Integration Reference

## Exchange Factory Pattern

TradeMAX maintains a single exchange service instance per trading session. The factory in `src/services/exchangeFactory.ts` returns either a `BybitService` or `PaperExchangeService` based on the user's configured exchange. Both implement the same runtime contract expected by the trade engine.

```
createExchangeService("bybit") → BybitService
createExchangeService("paper") → PaperExchangeService
```

The active instance is created when the agent starts and destroyed (`exchange.destroy()`) when it stops or the kill switch fires. This prevents key material from remaining in memory between sessions.

---

## Bybit Integration

**Source:** `src/services/bybitService.ts`

Bybit is accessed via the `bybit-api` npm package (v4.x, V5 API). The service uses the `RestClientV5` for REST calls and handles unified account balance and linear futures positions.

```typescript
import { RestClientV5 } from "bybit-api";
```

The V5 unified account endpoint returns balances across spot, derivatives, and options in a single response. Linear futures positions are queried from `GET /v5/position/list`.

Bybit order placement uses `POST /v5/order/create` with category `linear` for perpetual futures.

---

## Paper Trading Integration

**Source:** `src/services/paperExchangeService.ts`

Paper mode simulates:

- balances
- positions
- market orders
- closes with simple slippage

It still consumes live Bybit public ticker data so the engine can trade against real market prices without using exchange credentials.

---

## OpenAI Integration

**Source:** `src/services/aiService.ts`

### Request Contract

The trade engine sends a structured `AIPromptData` payload to OpenAI including:
- Current symbol and exchange
- Recent price bars (OHLCV)
- Computed indicator values (RSI, MACD line, MACD signal, MACD histogram)
- Current portfolio snapshot
- Open positions
- Configured risk profile

The model is instructed via a system prompt to respond with **only** a raw JSON object — no markdown, no code blocks, no extra text.

### Response Schema (Zod-validated)

```json
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": 0.0,
  "entry": 0.0,
  "stop_loss": 0.0,
  "take_profit": 0.0,
  "reason": "short explanation"
}
```

Validation is performed by the `aiDecisionSchema` Zod schema in `src/shared/validators.ts`. On any failure — JSON parse error, schema mismatch, or API timeout — the service returns the `HOLD_FALLBACK` constant and logs an error. The trade engine never crashes on an AI failure; it simply skips execution for that cycle.

### Model Configuration

The model is read from `process.env.OPENAI_MODEL` at runtime, defaulting to `gpt-5.4-mini`. The API key is read from `process.env.OPENAI_API_KEY`. Both are available only in the main process.

---

## Error Handling and Retry Policy

All exchange service calls that can fail follow this pattern:

1. First attempt.
2. On failure, retry up to `ENGINE.EXCHANGE_RETRY_COUNT` (3) times.
3. Delay between retries uses exponential backoff.
4. If all retries are exhausted, `safetyService.reportApiFailure()` is called which freezes the agent (`reason: "API_FAILURE"`).

The AI service applies a `ENGINE.AI_TIMEOUT_MS` (30 second) timeout per OpenAI call. If the call times out or throws, the HOLD fallback is returned immediately — no retries for AI calls to prevent stacked latency during a fast-moving market.

WebSocket reconnection for the market data stream is attempted up to `ENGINE.WS_RECONNECT_RETRIES` (3) times with a short pause between attempts. Failure to reconnect freezes the agent.

---

## Security Boundaries

- Exchange API keys and secrets are decrypted from MongoDB only inside the trade engine's `start()` call, immediately before `exchange.initialize()`.
- The decrypted values exist in memory only for the duration of the active session.
- `exchange.destroy()` zeroes out the key strings on stop.
- The renderer process never receives key values; IPC responses from settings endpoints return only existence flags or masked representations.
- All OpenAI API calls originate from the main process. The `OPENAI_API_KEY` environment variable is never forwarded to the renderer context.
