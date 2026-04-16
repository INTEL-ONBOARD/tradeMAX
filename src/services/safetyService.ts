import { logger } from "./loggerService.js";
import { saveSafetyState, getSafetyState } from "../main/sessionManager.js";
import { ENGINE_DEFAULTS } from "../shared/constants.js";
import type { SafetyState } from "../shared/types.js";

class SafetyService {
  private state: SafetyState;
  private maxConsecutiveLosses: number = ENGINE_DEFAULTS.maxConsecutiveLosses;
  private maxDrawdownPct: number = ENGINE_DEFAULTS.maxDrawdownPct;
  private onFreezeCallback: ((reason: SafetyState["frozenReason"]) => void) | null = null;

  constructor() {
    const persisted = getSafetyState();
    this.state = {
      frozen: persisted.frozen,
      frozenReason: persisted.frozenReason as SafetyState["frozenReason"],
      consecutiveLosses: persisted.consecutiveLosses,
      peakBalance: persisted.peakBalance,
      emergencyShutdown: persisted.emergencyShutdown,
    };
  }

  setOnFreezeCallback(cb: (reason: SafetyState["frozenReason"]) => void): void {
    this.onFreezeCallback = cb;
  }

  updateConfig(config: { maxConsecutiveLosses: number; maxDrawdownPct: number }): void {
    this.maxConsecutiveLosses = config.maxConsecutiveLosses;
    this.maxDrawdownPct = config.maxDrawdownPct;
  }

  getState(): SafetyState {
    return { ...this.state };
  }

  canTrade(): boolean {
    return !this.state.frozen && !this.state.emergencyShutdown;
  }

  recordWin(): void {
    this.state.consecutiveLosses = 0;
    this.persist();
  }

  recordLoss(): void {
    this.state.consecutiveLosses += 1;

    if (this.state.consecutiveLosses >= this.maxConsecutiveLosses) {
      this.freeze("CONSECUTIVE_LOSSES");
      logger.warn("SAFETY", `Agent frozen: ${this.maxConsecutiveLosses} consecutive losses`, {
        consecutiveLosses: this.state.consecutiveLosses,
      });
    }

    this.persist();
  }

  updatePeakBalance(currentBalance: number): void {
    if (currentBalance > this.state.peakBalance) {
      this.state.peakBalance = currentBalance;
      this.persist();
    }
  }

  checkDrawdown(currentBalance: number): boolean {
    if (this.state.peakBalance <= 0) return true;

    const drawdownPct = ((this.state.peakBalance - currentBalance) / this.state.peakBalance) * 100;
    if (drawdownPct >= this.maxDrawdownPct) {
      this.freeze("DRAWDOWN");
      logger.error("SAFETY", `Agent frozen: drawdown ${drawdownPct.toFixed(1)}% exceeds ${this.maxDrawdownPct}%`, {
        peakBalance: this.state.peakBalance,
        currentBalance,
        drawdownPct,
      });
      return false;
    }
    return true;
  }

  reportApiFailure(): void {
    this.freeze("API_FAILURE");
    logger.error("SAFETY", "Agent frozen: exchange API failure threshold reached");
  }

  freeze(reason: SafetyState["frozenReason"]): void {
    this.state.frozen = true;
    this.state.frozenReason = reason;
    this.persist();
    this.onFreezeCallback?.(reason);
  }

  activateKillSwitch(): void {
    this.state.frozen = true;
    this.state.frozenReason = "KILL_SWITCH";
    this.state.emergencyShutdown = true;
    this.persist();
    logger.error("SAFETY", "KILL SWITCH ACTIVATED — all trading halted");
  }

  resetFreeze(): void {
    this.state.frozen = false;
    this.state.frozenReason = null;
    this.state.consecutiveLosses = 0;
    this.state.emergencyShutdown = false;
    this.persist();
    logger.info("SAFETY", "Safety freeze cleared — agent can be re-enabled");
  }

  private persist(): void {
    saveSafetyState({
      frozen: this.state.frozen,
      frozenReason: this.state.frozenReason,
      consecutiveLosses: this.state.consecutiveLosses,
      peakBalance: this.state.peakBalance,
      emergencyShutdown: this.state.emergencyShutdown,
    });
  }
}

export const safetyService = new SafetyService();
