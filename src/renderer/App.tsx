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

export default function App() {
  const currentScreen = useAppStore((s) => s.currentScreen);

  useEffect(() => {
    if (!window.api) return;
    const store = useAppStore.getState();
    const unsubs: (() => void)[] = [];

    unsubs.push(window.api.on(STREAM.MARKET_TICK, (d) => store.setMarketTick(d as MarketTick)));
    unsubs.push(window.api.on(STREAM.PORTFOLIO, (d) => store.setPortfolio(d as PortfolioSnapshot)));
    unsubs.push(window.api.on(STREAM.POSITIONS, (d) => store.setPositions(d as Position[])));
    unsubs.push(window.api.on(STREAM.TRADE_EXECUTED, (d) => store.addTrade(d as Trade)));
    unsubs.push(window.api.on(STREAM.AI_DECISION, (d) => store.setLastAIDecision(d as AIDecision)));
    unsubs.push(window.api.on(STREAM.AGENT_STATUS, (d) => store.setAgentStatus(d as AgentStatus)));
    unsubs.push(window.api.on(STREAM.LOG, (d) => store.addLog(d as LogEntry)));

    unsubs.push(
      window.api.on("session:restored", (d) => {
        const data = d as { session: UserSession; settings: UserSettings };
        store.setUser(data.session);
        store.setSettings(data.settings);
        if (data.settings.themePreference) {
          store.setTheme(data.settings.themePreference);
        }
        store.setScreen("dashboard");
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
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
  );
}
