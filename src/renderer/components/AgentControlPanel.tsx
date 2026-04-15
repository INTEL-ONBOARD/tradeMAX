import { useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function AgentControlPanel() {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [confirmKill, setConfirmKill] = useState(false);

  const handleToggleAgent = async () => {
    if (agentStatus.running) {
      await window.api.invoke(IPC.AGENT_STOP);
    } else {
      await window.api.invoke(IPC.AGENT_START, { symbol });
    }
  };

  const handleKillSwitch = async () => {
    if (!confirmKill) {
      setConfirmKill(true);
      setTimeout(() => setConfirmKill(false), 3000);
      return;
    }
    await window.api.invoke(IPC.AGENT_KILL_SWITCH);
    setConfirmKill(false);
  };

  const handleModeChange = async (mode: "spot" | "futures") => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, { tradingMode: mode });
    setSettings(updated as typeof settings);
  };

  const handleExchangeChange = async (exchange: "binance" | "bybit") => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, { selectedExchange: exchange });
    setSettings(updated as typeof settings);
  };

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Agent Control</h3>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Agent Mode</span>
        <button
          onClick={handleToggleAgent}
          disabled={agentStatus.frozen}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            agentStatus.running ? "bg-green-500" : "bg-[var(--bg-surface)]"
          } ${agentStatus.frozen ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <motion.div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
            animate={{ left: agentStatus.running ? 26 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {agentStatus.frozen && (
        <p className="text-xs text-red-400">Frozen: {agentStatus.reason}</p>
      )}

      <input
        type="text"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        disabled={agentStatus.running}
        placeholder="Symbol"
        className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary disabled:opacity-50"
      />

      <div className="flex gap-2">
        {(["binance", "bybit"] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => handleExchangeChange(ex)}
            disabled={agentStatus.running}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              settings?.selectedExchange === ex
                ? "border-primary bg-primary/10 text-primary"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-primary/50"
            } disabled:opacity-50`}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["spot", "futures"] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            disabled={agentStatus.running}
            className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize ${
              settings?.tradingMode === m
                ? "border-accent bg-accent/10 text-accent"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:border-accent/50"
            } disabled:opacity-50`}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        onClick={handleKillSwitch}
        className={`w-full py-2 text-sm font-bold rounded-lg transition-colors ${
          confirmKill
            ? "bg-red-600 text-white"
            : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
        } kill-switch-pulse`}
      >
        {confirmKill ? "CONFIRM KILL" : "EMERGENCY KILL SWITCH"}
      </button>
    </GlassCard>
  );
}
