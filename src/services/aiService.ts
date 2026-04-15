import Anthropic from "@anthropic-ai/sdk";
import { aiDecisionSchema } from "../shared/validators.js";
import { logger } from "./loggerService.js";
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

No markdown, no code blocks, no extra text. Only the raw JSON object.`;

const HOLD_FALLBACK: AIDecision = {
  decision: "HOLD",
  confidence: 0,
  entry: 0,
  stop_loss: 0,
  take_profit: 0,
  reason: "AI fallback — unable to generate decision",
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY not set in environment");
  client = new Anthropic({ apiKey });
  return client;
}

export async function getAIDecision(data: AIPromptData): Promise<AIDecision> {
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: JSON.stringify(data, null, 2),
        },
      ],
    });

    const text = response.content[0];
    if (text.type !== "text") {
      await logger.warn("AI", "AI response was not text", { contentType: text.type });
      return HOLD_FALLBACK;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.text);
    } catch {
      await logger.error("AI", "AI_PARSE_ERROR: Failed to parse AI response as JSON", {
        rawResponse: text.text.substring(0, 500),
      });
      return HOLD_FALLBACK;
    }

    const validated = aiDecisionSchema.safeParse(parsed);
    if (!validated.success) {
      await logger.error("AI", "AI_VALIDATION_ERROR: AI response failed Zod validation", {
        errors: validated.error.issues,
        rawResponse: text.text.substring(0, 500),
      });
      return HOLD_FALLBACK;
    }

    return validated.data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    const isTimeout = message.includes("timeout") || message.includes("ETIMEDOUT");

    await logger.error("AI", isTimeout ? "AI_TIMEOUT" : "AI_API_ERROR", {
      error: message,
    });

    return HOLD_FALLBACK;
  }
}
