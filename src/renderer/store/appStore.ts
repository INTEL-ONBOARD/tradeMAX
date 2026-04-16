import { create } from "zustand";
import type {
  UserSession,
  UserSettings,
  PortfolioSnapshot,
  Position,
  Trade,
  AIDecision,
  AgentStatus,
  LogEntry,
  MarketTick,
} from "../../shared/types.js";

interface AppState {
  currentScreen: "intro" | "auth" | "dashboard";
  authMode: "login" | "register";

  user: UserSession | null;
  settings: UserSettings | null;

  theme: "dark" | "light";

  portfolio: PortfolioSnapshot | null;
  positions: Position[];
  trades: Trade[];
  lastAIDecision: AIDecision | null;
  agentStatus: AgentStatus;
  logs: LogEntry[];
  marketTick: MarketTick | null;

  setScreen: (screen: AppState["currentScreen"]) => void;
  setAuthMode: (mode: AppState["authMode"]) => void;
  setUser: (user: UserSession | null) => void;
  setSettings: (settings: UserSettings | null) => void;
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;

  setPortfolio: (p: PortfolioSnapshot) => void;
  setPositions: (p: Position[]) => void;
  addTrade: (t: Trade) => void;
  setTrades: (t: Trade[]) => void;
  setLastAIDecision: (d: AIDecision) => void;
  setAgentStatus: (s: AgentStatus) => void;
  addLog: (l: LogEntry) => void;
  setLogs: (l: LogEntry[]) => void;
  setMarketTick: (t: MarketTick) => void;

  reset: () => void;
}

const MAX_LOGS = 200;

export const useAppStore = create<AppState>((set) => ({
  currentScreen: "intro",
  authMode: "login",

  user: null,
  settings: null,

  theme: "light",

  portfolio: null,
  positions: [],
  trades: [],
  lastAIDecision: null,
  agentStatus: { running: false, frozen: false },
  logs: [],
  marketTick: null,

  setScreen: (screen) => set({ currentScreen: screen }),
  setAuthMode: (mode) => set({ authMode: mode }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme-preference", next);
      return { theme: next };
    }),

  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme-preference", theme);
    set({ theme });
  },

  setPortfolio: (portfolio) => set({ portfolio }),
  setPositions: (positions) => set({ positions }),
  addTrade: (t) => set((s) => ({ trades: [t, ...s.trades].slice(0, 50) })),
  setTrades: (trades) => set({ trades }),
  setLastAIDecision: (d) => set({ lastAIDecision: d }),
  setAgentStatus: (s) => set({ agentStatus: s }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, MAX_LOGS) })),
  setLogs: (logs) => set({ logs }),
  setMarketTick: (t) => set({ marketTick: t }),

  reset: () =>
    set({
      currentScreen: "intro",
      user: null,
      settings: null,
      portfolio: null,
      positions: [],
      trades: [],
      lastAIDecision: null,
      agentStatus: { running: false, frozen: false },
      logs: [],
      marketTick: null,
    }),
}));
