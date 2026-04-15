import Store from "electron-store";

interface SessionData {
  token: string;
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}

const store = new Store<{ session: SessionData | null }>({
  name: "trademax-session",
  defaults: { session: null },
});

export function saveSession(token: string): void {
  const existing = store.get("session");
  store.set("session", {
    token,
    frozen: existing?.frozen ?? false,
    frozenReason: existing?.frozenReason ?? null,
    consecutiveLosses: existing?.consecutiveLosses ?? 0,
    peakBalance: existing?.peakBalance ?? 0,
    emergencyShutdown: existing?.emergencyShutdown ?? false,
  });
}

export function getToken(): string | null {
  return store.get("session")?.token ?? null;
}

export function clearSession(): void {
  store.delete("session");
}

export function saveSafetyState(state: {
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
}): void {
  const existing = store.get("session");
  if (!existing) return;
  store.set("session", { ...existing, ...state });
}

export function getSafetyState(): {
  frozen: boolean;
  frozenReason: string | null;
  consecutiveLosses: number;
  peakBalance: number;
  emergencyShutdown: boolean;
} {
  const session = store.get("session");
  return {
    frozen: session?.frozen ?? false,
    frozenReason: session?.frozenReason ?? null,
    consecutiveLosses: session?.consecutiveLosses ?? 0,
    peakBalance: session?.peakBalance ?? 0,
    emergencyShutdown: session?.emergencyShutdown ?? false,
  };
}
