import { create } from "zustand";

type Screen = "intro" | "auth" | "dashboard";

interface AppState {
    screen: Screen;
    authMode: "login" | "register";
    session: any | null;
    theme: "dark" | "light";
    setScreen: (screen: Screen) => void;
    setAuthMode: (mode: "login" | "register") => void;
    setSession: (session: any | null) => void;
    setTheme: (theme: "dark" | "light") => void;
}

export const useAppStore = create<AppState>((set) => ({
    screen: "intro",
    authMode: "login",
    session: null,
    theme: "dark",
    setScreen: (screen) => set({ screen }),
    setAuthMode: (authMode) => set({ authMode }),
    setSession: (session) => set({ session }),
    setTheme: (theme) => set({ theme })
}));
