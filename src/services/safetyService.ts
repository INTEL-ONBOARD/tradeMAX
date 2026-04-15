interface SafetyState {
    tradingFrozen: boolean;
    emergencyShutdown: boolean;
    consecutiveLosses: number;
    peakBalance: number;
}

const stateByUser = new Map<string, SafetyState>();

function getState(userId: string): SafetyState {
    const existing = stateByUser.get(userId);
    if (existing) {
        return existing;
    }
    const created: SafetyState = {
        tradingFrozen: false,
        emergencyShutdown: false,
        consecutiveLosses: 0,
        peakBalance: 0
    };
    stateByUser.set(userId, created);
    return created;
}

export function registerClosedTrade(userId: string, pnl: number): void {
    const state = getState(userId);
    state.consecutiveLosses = pnl < 0 ? state.consecutiveLosses + 1 : 0;
    if (state.consecutiveLosses >= 3) {
        state.tradingFrozen = true;
    }
}

export function updateBalance(userId: string, balance: number): { drawdownPct: number } {
    const state = getState(userId);
    state.peakBalance = Math.max(state.peakBalance, balance);
    if (state.peakBalance === 0) {
        return { drawdownPct: 0 };
    }
    const drawdownPct = (state.peakBalance - balance) / state.peakBalance;
    return { drawdownPct };
}

export function freezeTrading(userId: string): void {
    const state = getState(userId);
    state.tradingFrozen = true;
}

export function emergencyShutdown(userId: string): void {
    const state = getState(userId);
    state.tradingFrozen = true;
    state.emergencyShutdown = true;
}

export function clearEmergencyShutdown(userId: string): void {
    const state = getState(userId);
    state.emergencyShutdown = false;
}

export function canTrade(userId: string): { ok: boolean; reasons: string[] } {
    const state = getState(userId);
    const reasons: string[] = [];
    if (state.tradingFrozen) {
        reasons.push("Trading is frozen by safety controls");
    }
    if (state.emergencyShutdown) {
        reasons.push("Emergency shutdown active");
    }
    return { ok: reasons.length === 0, reasons };
}
