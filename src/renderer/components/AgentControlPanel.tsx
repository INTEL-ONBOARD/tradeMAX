import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { AgentConfigModal } from "./AgentConfigModal";
import { Sliders } from "./icons";

export function AgentControlPanel() {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const marketTick = useAppStore((s) => s.marketTick);
  const [confirmKill, setConfirmKill] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const settings = useAppStore((s) => s.settings);
  const symbol = settings?.engineConfig?.tradingSymbol || "BTCUSDT";
  const autoPair = settings?.engineConfig?.autoPairSelection || false;
  const profile = settings?.engineConfig?.tradingProfile || "intraday";
  const activeSymbol = autoPair ? (marketTick?.symbol || symbol) : symbol;

  const handleToggleAgent = async () => {
    setToggling(true);
    try {
      if (agentStatus.running) {
        await window.api.invoke(IPC.AGENT_STOP);
      } else {
        await window.api.invoke(IPC.AGENT_START, { symbol });
      }
    } finally {
      setToggling(false);
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

  const isRunning = agentStatus.running;

  return (
    <div className="flex flex-col items-center justify-center py-10 w-full mx-4 relative">
      {/* Decorative Outer Dial Ring */}
      <div className="relative w-48 h-48 rounded-full border-[12px] border-[var(--bg-inset)] flex items-center justify-center mb-6 shadow-inner">
        {/* Dial Ticks (Visual representation) */}
        <div className="absolute inset-0 rounded-full" 
             style={{ background: isRunning ? "radial-gradient(ellipse at center, rgba(16,185,129,0.2) 0%, transparent 70%)" : "transparent" }} />
             
        {/* Play/Stop center button simulating the needle center */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center z-10 transition-colors shadow-lg ${
          isRunning ? "bg-[var(--color-profit)] shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "bg-[var(--text-tertiary)]"
        }`}>
          <div className="w-4 h-4 bg-[var(--bg-base)] rounded-full relative">
             <div className="absolute w-12 h-1 bg-[var(--bg-base)] left-2 top-1.5 origin-left" 
                  style={{ transform: isRunning ? "rotate(135deg)" : "rotate(45deg)", transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }} />
          </div>
        </div>

        {/* Status Text under dial center inside ring */}
        <span className={`absolute bottom-6 font-bold tracking-widest text-sm ${isRunning ? "text-[var(--color-profit)]" : "text-[var(--color-warn)]"}`}>
          {isRunning ? "LIVE" : "OFF"}
        </span>
      </div>

      <h2 className="text-xl font-medium text-[var(--text-primary)] mb-1">TradeMAX Agent</h2>

      {/* Pair badge + Config button */}
      <div className="flex items-center gap-2 mb-6">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[var(--bg-inset)] text-[var(--text-secondary)] border border-[var(--border)]">
          {autoPair ? `AUTO ${activeSymbol}` : activeSymbol}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[var(--bg-inset)] text-[var(--text-secondary)] border border-[var(--border)]">
          {profile.toUpperCase()}
        </span>
        <button
          onClick={() => setConfigOpen(true)}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] border border-transparent hover:border-[var(--border)] transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Sliders size={11} />
          Configure
        </button>
      </div>

      {/* Main Action Button */}
      <button
        onClick={handleToggleAgent}
        disabled={agentStatus.frozen && !agentStatus.running}
        className={`w-64 py-4 rounded-full text-lg font-bold transition-all shadow-lg ${
          isRunning 
            ? "bg-transparent border-2 border-[var(--color-loss)] text-[var(--color-loss)] hover:bg-[var(--color-loss-bg)]"
            : "bg-[var(--color-loss)] text-white hover:brightness-110 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
        } disabled:opacity-50`}
      >
        {toggling ? "Processing..." : isRunning ? "Stop Agent" : "Turn On"}
      </button>

      <button onClick={handleKillSwitch} className={`mt-4 text-sm underline transition-colors ${confirmKill ? "text-[var(--color-loss)] font-bold" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}>
        {confirmKill ? "Confirm Emergency Kill" : "Emergency Kill Switch"}
      </button>

      {agentStatus.frozen && (
        <div className="absolute top-4 right-4 bg-[var(--color-loss-bg)] border border-[var(--color-loss-border)] px-4 py-2 rounded-md">
          <p className="text-xs text-[var(--color-loss)] font-bold">Safety Freeze</p>
          <button onClick={() => window.api.invoke(IPC.AGENT_RESET_FREEZE)} className="text-[10px] underline text-[var(--color-loss)] mt-1">Reset</button>
        </div>
      )}
      
      <p className="text-[11px] text-[var(--text-tertiary)] mt-8 max-w-[280px] text-center">
        Stop unnecessary apps/services for a better trading experience.
      </p>

      <AgentConfigModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}
