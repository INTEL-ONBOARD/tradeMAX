import { GlassCard } from "./GlassCard";
import { AgentControlPanel } from "./AgentControlPanel";
import { PortfolioPanel } from "./PortfolioPanel";
import { AIDecisionFeed } from "./AIDecisionFeed";
import { APIKeysPanel } from "./APIKeysPanel";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function Sidebar() {
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const reset = useAppStore((s) => s.reset);

  const handleLogout = async () => {
    await window.api.invoke(IPC.AUTH_LOGOUT);
    reset();
  };

  return (
    <aside className="w-[260px] min-w-[260px] h-screen flex flex-col gap-3 p-3 overflow-y-auto border-r border-[var(--border)]">
      <div className="px-3 py-4 text-center">
        <h1 className="text-xl font-bold text-primary">
          Trade<span className="text-accent">MAX</span>
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{user?.email}</p>
      </div>

      <AgentControlPanel />
      <PortfolioPanel />
      <AIDecisionFeed />

      <GlassCard className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Settings</h3>

        <APIKeysPanel />

        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-[var(--text-secondary)]">Theme</span>
          <button
            onClick={async () => {
              toggleTheme();
              const next = theme === "dark" ? "light" : "dark";
              await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: next });
            }}
            className="text-sm px-3 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] hover:border-primary transition-colors"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mt-2 w-full py-2 text-sm rounded-lg text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
        >
          Logout
        </button>
      </GlassCard>
    </aside>
  );
}
