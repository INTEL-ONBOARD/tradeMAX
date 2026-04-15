import Anthropic from "@anthropic-ai/sdk";
import { type AIDecision } from "../shared/types.js";
import { aiDecisionSchema } from "../shared/validators.js";
import { writeLog } from "./loggerService.js";

const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";

export class AIService {
    private client: Anthropic | null;

    constructor() {
        const key = process.env.CLAUDE_API_KEY;
        this.client = key ? new Anthropic({ apiKey: key }) : null;
    }

    async decide(payload: {
        marketPrice: number;
        indicators: { rsi: number; macd: number; volume: number };
        portfolio: Record<string, unknown>;
        openPositions: unknown[];
    }): Promise<AIDecision> {
        if (!this.client) {
            return {
                decision: "HOLD",
                confidence: 0,
                entry: payload.marketPrice,
                stop_loss: payload.marketPrice,
                take_profit: payload.marketPrice,
                reason: "Claude API key missing"
            };
        }

        const systemPrompt =
            "You are a trading assistant. Return strict JSON only with keys: decision, confidence, entry, stop_loss, take_profit, reason. Decision must be BUY, SELL, or HOLD.";

        const msg = await this.client.messages.create({
            model,
            max_tokens: 250,
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: JSON.stringify(payload)
                }
            ]
        });

        const text = msg.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("\n")
            .trim();

        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            await writeLog({
                level: "WARN",
                category: "AI",
                message: "Claude returned non-JSON response",
                context: { text }
            });
            throw new Error("Invalid AI response");
        }

        return aiDecisionSchema.parse(parsed) as AIDecision;
    }
}
