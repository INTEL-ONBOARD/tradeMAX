import OpenAI from "openai";
import { aiDecisionSchema } from "../shared/validators.js";
import { logger } from "./loggerService.js";
import { ENGINE, ENGINE_DEFAULTS } from "../shared/constants.js";
import type { AIDecision, AIPromptData } from "../shared/types.js";

const SYSTEM_PROMPT = `You are a quantitative crypto trading analyst. Analyze the provided market data and return a strict JSON trading decision. You are advisory only — your output will be validated by a risk engine before any execution. Never recommend risking more than the user's configured risk profile allows.

You MUST respond with ONLY a JSON object in this exact format:
{
  "decision": "BUY" | "SELL" | "HOLD",
  "confidence": <number between 0 and 1>,
  "entry": <positive number>,
  "stop_loss": <positive number>,
  "take_profit": <positive number>,
  "reason": "<short explanation>"
}

CRITICAL RULES for stop_loss and take_profit:
- For BUY decisions: stop_loss MUST be BELOW entry, take_profit MUST be ABOVE entry
- For SELL decisions: stop_loss MUST be ABOVE entry, take_profit MUST be BELOW entry
- For HOLD decisions: entry, stop_loss, take_profit should all equal the current price

The input data may include additional indicators (EMA, Bollinger Bands), recent candle history, recent trade outcomes, and spread information. Use all available data to inform your decision.

If a marketRegime field is present, adapt your strategy:
- "trending_up": favor BUY positions with wider take-profits
- "trending_down": favor SELL positions with wider take-profits
- "ranging": prefer HOLD unless strong signals at support/resistance
- "volatile": tighten stop-losses and reduce position confidence

No markdown, no code blocks, no extra text. Only the raw JSON object.`;

const AI_DECISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    decision: {
      type: "string",
      enum: ["BUY", "SELL", "HOLD"],
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    entry: {
      type: "number",
      exclusiveMinimum: 0,
    },
    stop_loss: {
      type: "number",
      exclusiveMinimum: 0,
    },
    take_profit: {
      type: "number",
      exclusiveMinimum: 0,
    },
    reason: {
      type: "string",
      minLength: 1,
    },
  },
  required: ["decision", "confidence", "entry", "stop_loss", "take_profit", "reason"],
  additionalProperties: false,
} as const;

const HOLD_FALLBACK: AIDecision = {
  decision: "HOLD",
  confidence: 0,
  entry: 0,
  stop_loss: 0,
  take_profit: 0,
  reason: "AI fallback — unable to generate decision",
};

let client: OpenAI | null = null;
let currentApiKey: string | null = null;

function getClient(apiKey: string): OpenAI {
  if (client && currentApiKey === apiKey) return client;
  client = new OpenAI({ apiKey });
  currentApiKey = apiKey;
  return client;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getAIDecision(
  data: AIPromptData,
  openaiApiKey?: string,
  model?: string,
  retryCount?: number,
): Promise<AIDecision> {
  const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await logger.error("AI", "No OpenAI API key configured — set it in Settings or .env");
    return HOLD_FALLBACK;
  }

  const resolvedModel = model || process.env.OPENAI_MODEL || ENGINE_DEFAULTS.aiModel;
  const maxRetries = retryCount ?? ENGINE_DEFAULTS.aiRetryCount;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), ENGINE.AI_TIMEOUT_MS);

      try {
        const response = await Promise.race([
          getClient(apiKey).responses.create(
            {
              model: resolvedModel,
              // Trading prompts can include sensitive strategy and account state.
              // Disable provider-side storage for this workload.
              store: false,
              input: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: JSON.stringify(data, null, 2) },
              ],
              text: {
                format: {
                  type: "json_schema",
                  name: "trade_decision",
                  schema: AI_DECISION_JSON_SCHEMA,
                  strict: true,
                },
              },
            },
            { signal: controller.signal },
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI request timed out")), ENGINE.AI_TIMEOUT_MS),
          ),
        ]);

        const rawText = response.output_text?.trim();
        if (!rawText) {
          await logger.warn("AI", "AI response did not contain output_text");
          return HOLD_FALLBACK;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          await logger.error("AI", "AI_PARSE_ERROR: Failed to parse AI response as JSON", {
            rawResponse: rawText,
            model: resolvedModel,
          });
          return HOLD_FALLBACK;
        }

        const validated = aiDecisionSchema.safeParse(parsed);
        if (!validated.success) {
          await logger.error("AI", "AI_VALIDATION_ERROR: AI response failed Zod validation", {
            errors: validated.error.issues,
            rawResponse: rawText,
            model: resolvedModel,
          });
          return HOLD_FALLBACK;
        }

        return validated.data;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown AI error";
      const isTimeout = message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("aborted");
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        await logger.error("AI", isTimeout ? "AI_TIMEOUT" : "AI_API_ERROR", {
          error: message,
          attempts: attempt + 1,
          model: resolvedModel,
        });
        return HOLD_FALLBACK;
      }

      const backoffMs = Math.pow(2, attempt) * 500;
      await logger.warn("AI", `AI attempt ${attempt + 1} failed, retrying in ${backoffMs}ms`, {
        error: message,
        attempt: attempt + 1,
        maxRetries,
        model: resolvedModel,
      });
      await delay(backoffMs);
    }
  }

  return HOLD_FALLBACK;
}
