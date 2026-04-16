import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "./store/appStore";
import { IntroPage } from "./pages/IntroPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { STREAM } from "../shared/constants";
import type {
  PortfolioSnapshot,
  Position,
  Trade,
  AIDecision,
  AgentStatus,
  LogEntry,
  MarketTick,
  UserSession,
  UserSettings,
} from "../shared/types";

import { CustomTitleBar } from "./components/CustomTitleBar";
import { ConnectivityOverlay } from "./components/ConnectivityOverlay";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen);
  const store = useAppStore.getState();

  // Initialize theme from localStorage on app startup
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme-preference") as "dark" | "light" | null;
    if (savedTheme) {
      store.setTheme(savedTheme);
    } else {
      // Default to light theme on first load
      store.setTheme("light");
    }
  }, []);

  useEffect(() => {
    const api = window.api;
    if (!api) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(api.on(STREAM.MARKET_TICK, (d: any) => store.setMarketTick(d as MarketTick)));
    unsubs.push(api.on(STREAM.PORTFOLIO, (d: any) => store.setPortfolio(d as PortfolioSnapshot)));
    unsubs.push(api.on(STREAM.POSITIONS, (d: any) => store.setPositions(d as Position[])));
    unsubs.push(api.on(STREAM.TRADE_EXECUTED, (d: any) => store.addTrade(d as Trade)));
    unsubs.push(api.on(STREAM.AI_DECISION, (d: any) => store.setLastAIDecision(d as AIDecision)));
    unsubs.push(api.on(STREAM.AGENT_STATUS, (d: any) => store.setAgentStatus(d as AgentStatus)));
    unsubs.push(api.on(STREAM.LOG, (d: any) => store.addLog(d as LogEntry)));

    unsubs.push(
      api.on("session:restored", (d: any) => {
        const data = d as { session: UserSession; settings: UserSettings };
        store.setUser(data.session);
        store.setSettings(data.settings);
        const savedPref = localStorage.getItem("theme-preference") as "dark" | "light" | null;
        const theme = savedPref ?? data.settings.themePreference ?? "light";
        store.setTheme(theme);
        store.setScreen("dashboard");

        // Auto-fetch portfolio and positions if exchange keys are configured
        if (data.settings.hasBinanceKeys || data.settings.hasBybitKeys) {
          api.invoke("portfolio:get").then((p: any) => {
            if (p) store.setPortfolio(p as PortfolioSnapshot);
          }).catch(() => {});
          api.invoke("positions:get").then((pos: any) => {
            const arr = pos as Position[];
            if (arr.length > 0) store.setPositions(arr);
          }).catch(() => {});
        }
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
        <ConnectivityOverlay />

        {/* Invisible drag region for Intro/Auth pages */}
        {currentScreen !== "dashboard" && <div className="absolute top-0 left-0 right-0 h-8 z-50" style={{ WebkitAppRegion: "drag", pointerEvents: "none" } as React.CSSProperties} />}

        <div className="h-full w-full relative">
          <AnimatePresence mode="wait">
            {currentScreen === "intro" && (
              <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <IntroPage />
              </motion.div>
            )}
            {currentScreen === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <AuthPage />
              </motion.div>
            )}
            {currentScreen === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <DashboardPage />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  );
}
