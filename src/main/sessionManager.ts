import { type UserSession } from "../shared/types.js";
import Store from "electron-store";

interface AuthState {
    token: string;
    session: UserSession;
}

let authState: AuthState | null = null;
const store = new Store<{ authState: AuthState | null }>({ name: "trademax-session" });

export function setAuthState(state: AuthState): void {
    authState = state;
    store.set("authState", state);
}

export function clearAuthState(): void {
    authState = null;
    store.delete("authState");
}

export function getAuthState(): AuthState | null {
    if (authState) {
        return authState;
    }
    const saved = store.get("authState");
    authState = saved || null;
    return authState;
}
