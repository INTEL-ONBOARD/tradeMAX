import { z } from "zod";

export const aiDecisionSchema = z.object({
    decision: z.enum(["BUY", "SELL", "HOLD"]),
    confidence: z.number().min(0).max(1),
    entry: z.number(),
    stop_loss: z.number(),
    take_profit: z.number(),
    reason: z.string().min(3).max(500)
});

export const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8)
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
});
