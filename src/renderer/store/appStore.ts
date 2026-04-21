import { create } from "zustand";
import type {
  ClosedPnlRecord,
  UserSession,
  UserSettings,
  PortfolioSnapshot,
  Position,
  Trade,
  AgentCycleResult,
  AgentStatus,
  LogEntry,
  MarketTick,
  AppNotification,
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
  exchangeHistory: ClosedPnlRecord[];
  lastAIDecision: AgentCycleResult | null;
  agentStatus: AgentStatus;
  logs: LogEntry[];
  marketTick: MarketTick | null;
  notifications: AppNotification[];

  setScreen: (screen: AppState["currentScreen"]) => void;
  setAuthMode: (mode: AppState["authMode"]) => void;
  setUser: (user: UserSession | null) => void;
  setSettings: (settings: UserSettings | null) => void;
  toggleTheme: () => void;
  setTheme: (theme: "dark" | "light") => void;

  setPortfolio: (p: PortfolioSnapshot | null) => void;
  setPositions: (p: Position[]) => void;
  addTrade: (t: Trade) => void;
  setTrades: (t: Trade[]) => void;
  setExchangeHistory: (h: ClosedPnlRecord[]) => void;
  setLastAIDecision: (d: AgentCycleResult) => void;
  setAgentStatus: (s: AgentStatus) => void;
  addLog: (l: LogEntry) => void;
  setLogs: (l: LogEntry[]) => void;
  setMarketTick: (t: MarketTick) => void;

  addNotification: (n: AppNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

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
  exchangeHistory: [],
  lastAIDecision: null,
  agentStatus: { running: false, frozen: false, activeSymbols: [], leaderboard: [] },
  logs: [],
  marketTick: null,
  notifications: [],

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
  addTrade: (t) => set((s) => {
    const updates: Partial<typeof s> = { trades: [t, ...s.trades].slice(0, 50) };
    // When a trade closes, also append to exchangeHistory so equity curve + performance update in real-time
    if (t.status === "CLOSED" && t.pnl !== null && t.exitPrice !== null && t.closedAt) {
      updates.exchangeHistory = [...s.exchangeHistory, {
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        pnl: t.pnl,
        closedAt: t.closedAt,
      }].sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());
    }
    return updates;
  }),
  setTrades: (trades) => set({ trades }),
  setExchangeHistory: (exchangeHistory) => set({ exchangeHistory }),
  setLastAIDecision: (d) => set({ lastAIDecision: d }),
  setAgentStatus: (s) => set({ agentStatus: s }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, MAX_LOGS) })),
  setLogs: (logs) => set({ logs }),
  setMarketTick: (t) => set({ marketTick: t }),

  addNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),

  reset: () =>
    set({
      currentScreen: "intro",
      user: null,
      settings: null,
      portfolio: null,
      positions: [],
      trades: [],
      exchangeHistory: [],
      lastAIDecision: null,
      agentStatus: { running: false, frozen: false, activeSymbols: [], leaderboard: [] },
      logs: [],
      marketTick: null,
      notifications: [],
    }),
}));
