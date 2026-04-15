import { EventEmitter } from "node:events";
import { LogModel } from "../db/models/Log.js";

export const logStream = new EventEmitter();

export async function writeLog(params: {
    level: "INFO" | "WARN" | "ERROR";
    category: string;
    message: string;
    userId?: string;
    context?: Record<string, unknown>;
}): Promise<void> {
    const payload = {
        userId: params.userId,
        level: params.level,
        category: params.category,
        message: params.message,
        context: params.context || {}
    };

    try {
        await LogModel.create(payload);
    } catch {
        // Keep UI stream resilient even if DB writes fail.
    }

    logStream.emit("event", {
        ...payload,
        createdAt: new Date().toISOString()
    });
}
