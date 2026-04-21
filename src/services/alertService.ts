import type { SafetyState } from "../shared/types.js";
import { notificationService } from "./notificationService.js";

type AlertPayload = {
  type: "trade" | "risk" | "system" | "ai";
  title: string;
  message: string;
};

type AlertCallback = (alert: AlertPayload) => void;

class AlertService {
  private callback: AlertCallback | null = null;
  private dailyLossAlertSent = false;
  private lastDailyResetKey = "";

  setCallback(cb: AlertCallback): void {
    this.callback = cb;
  }

  clearCallback(): void {
    this.callback = null;
  }

  onTradeExecuted(symbol: string, side: string, quantity: number, price: number): void {
    this.emit("trade", "Trade Executed", `${side} ${quantity} ${symbol} @ $${price.toFixed(2)}`);
  }

  onPositionClosed(symbol: string, reason: string, pnl: number): void {
    const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    this.emit(pnl >= 0 ? "trade" : "risk", `Position Closed — ${reason}`, `${symbol} ${pnlStr}`);
  }

  onSafetyFreeze(reason: SafetyState["frozenReason"]): void {
    this.emit("risk", "Agent Frozen", `Safety triggered: ${reason ?? "unknown"}. Trading halted.`);
  }

  onDailyLossWarning(currentLoss: number, limit: number): void {
    this.resetDailyIfNeeded();
    if (this.dailyLossAlertSent) return;
    const pct = ((currentLoss / limit) * 100).toFixed(0);
    this.emit("risk", "Daily Loss Warning", `Daily loss at ${pct}% of limit ($${currentLoss.toFixed(2)} / $${limit.toFixed(2)})`);
    this.dailyLossAlertSent = true;
  }

  onApiError(exchange: string, attempt: number, maxAttempts: number): void {
    if (attempt >= maxAttempts - 1) {
      this.emit("system", "Exchange API Failing", `${exchange} API failed ${attempt}x. Agent may freeze.`);
    }
  }

  onAIDecision(decision: string, confidence: number, reason: string): void {
    if (decision !== "HOLD") {
      this.emit("ai", `AI Signal: ${decision}`, `Confidence: ${(confidence * 100).toFixed(0)}% — ${reason}`);
    }
  }

  resetDaily(): void {
    this.dailyLossAlertSent = false;
    this.lastDailyResetKey = this.getDailyResetKey();
  }

  private emit(type: AlertPayload["type"], title: string, message: string): void {
    this.callback?.({ type, title, message });
    notificationService.notify({ type, title, message });
  }

  private resetDailyIfNeeded(): void {
    const currentKey = this.getDailyResetKey();
    if (currentKey === this.lastDailyResetKey) return;
    this.dailyLossAlertSent = false;
    this.lastDailyResetKey = currentKey;
  }

  private getDailyResetKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

export const alertService = new AlertService();
