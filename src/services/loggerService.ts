import { EventEmitter } from "node:events";
import { LogModel } from "../db/models/Log.js";
import type { LogLevel, LogCategory, LogEntry } from "../shared/types.js";

class LoggerService extends EventEmitter {
  private userId: string | null = null;

  setUserId(userId: string): void {
    this.userId = userId;
  }

  clearUserId(): void {
    this.userId = null;
  }

  async log(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    const entry: LogEntry = {
      userId: this.userId ?? "system",
      level,
      category,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    this.emit("log", entry);

    if (this.userId) {
      try {
        await LogModel.create({
          userId: this.userId,
          level,
          category,
          message,
          meta: meta ?? {},
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("[Logger] Failed to persist log:", err);
      }
    }
  }

  info(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("INFO", category, message, meta);
  }

  warn(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("WARN", category, message, meta);
  }

  error(category: LogCategory, message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log("ERROR", category, message, meta);
  }
}

export const logger = new LoggerService();
