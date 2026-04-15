import { logger } from "./loggerService.js";
import { saveSafetyState, getSafetyState } from "../main/sessionManager.js";
import { ENGINE } from "../shared/constants.js";
import type { SafetyState } from "../shared/types.js";

class SafetyService {
  private state: SafetyState;

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

    if (this.state.consecutiveLosses >= ENGINE.MAX_CONSECUTIVE_LOSSES) {
      this.freeze("CONSECUTIVE_LOSSES");
      logger.warn("SAFETY", `Agent frozen: ${ENGINE.MAX_CONSECUTIVE_LOSSES} consecutive losses`, {
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
    if (drawdownPct >= ENGINE.MAX_DRAWDOWN_PCT) {
      this.freeze("DRAWDOWN");
      logger.error("SAFETY", `Agent frozen: drawdown ${drawdownPct.toFixed(1)}% exceeds ${ENGINE.MAX_DRAWDOWN_PCT}%`, {
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
