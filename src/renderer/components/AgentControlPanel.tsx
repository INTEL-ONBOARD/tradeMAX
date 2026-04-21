import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { resolvePreferredTradingSymbol } from "../../shared/engineConfigUtils";
import { AgentConfigModal } from "./AgentConfigModal";
import { Sliders } from "./icons";

export function AgentControlPanel() {
  const agentStatus = useAppStore((s) => s.agentStatus);
  const marketTick = useAppStore((s) => s.marketTick);
  const [confirmKill, setConfirmKill] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const settings = useAppStore((s) => s.settings);
  const symbol = resolvePreferredTradingSymbol(settings?.engineConfig);
  const autoPair = settings?.engineConfig?.autoPairSelection || false;
  const profile = settings?.engineConfig?.tradingProfile || "intraday";
  const activeSymbols = agentStatus.activeSymbols ?? [];
  const activeSymbol = autoPair ? (marketTick?.symbol || activeSymbols[0] || symbol) : symbol;
  const leaderboard = (agentStatus.leaderboard ?? []).slice(0, 3);

  const handleToggleAgent = async () => {
    setToggling(true);
    setErrorMessage(null);
    try {
      if (agentStatus.running) {
        await window.api.invoke(IPC.AGENT_STOP);
      } else {
        await window.api.invoke(IPC.AGENT_START, { symbol });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to change agent state");
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
  const normalizedError = errorMessage
    ? errorMessage.replace(/^Error invoking remote method '[^']+':\s*/i, "").replace(/^Error:\s*/i, "").trim()
    : null;
  const statusTitle = (() => {
    if (normalizedError) return "AI Agent action failed.";
    if (toggling) return "Updating agent state...";
    if (!isRunning) return "AI Agent is not running.";
    if (agentStatus.frozen) return "AI Agent paused by safety protection.";
    if (autoPair) return "Scanning market and rotating to top pairs.";
    return `Monitoring ${activeSymbol} and evaluating entries.`;
  })();
  const statusDetail = (() => {
    if (normalizedError) return normalizedError;
    if (toggling) return "Applying your latest command.";
    if (!isRunning) return "Press Turn On to start live analysis.";
    if (agentStatus.reason) return agentStatus.reason;
    if (agentStatus.lastUpdatedAt) {
      const ts = new Date(agentStatus.lastUpdatedAt);
      if (!Number.isNaN(ts.getTime())) {
        return `Last update ${ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      }
    }
    return "Listening to market data and running the AI decision loop.";
  })();
  const statusDotState =
    normalizedError
      ? "error"
      : toggling
        ? "busy"
        : !isRunning
          ? "idle"
          : agentStatus.frozen
            ? "frozen"
            : "running";

  return (
    <div className="flex flex-col items-center justify-center py-10 pb-20 w-full mx-4 min-h-full relative">
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

      <h2 className="text-xl font-medium text-[var(--text-primary)] mb-3">TradeMAX Agent</h2>

      {/* Pair badges */}
      <div className="flex items-center gap-2 mb-4">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[var(--bg-inset)] text-[var(--text-secondary)] border border-[var(--border)]">
          {autoPair ? `AUTO ${activeSymbol}` : activeSymbol}
        </span>
        {activeSymbols.length > 1 && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info-border)]">
            {activeSymbols.length} SYMBOLS
          </span>
        )}
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[var(--bg-inset)] text-[var(--text-secondary)] border border-[var(--border)]">
          {profile.toUpperCase()}
        </span>
      </div>

      {/* Main Action Button */}
      <button
        onClick={handleToggleAgent}
        disabled={agentStatus.frozen && !agentStatus.running}
        className={`w-64 py-4 mt-1 rounded-full text-lg font-bold transition-all shadow-lg ${
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

      <button
        onClick={() => setConfigOpen(true)}
        disabled={isRunning}
        className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] border border-transparent hover:border-[var(--border)] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        <Sliders size={12} />
        Configure
      </button>

      {agentStatus.frozen && (
        <div className="absolute top-4 right-4 bg-[var(--color-loss-bg)] border border-[var(--color-loss-border)] px-4 py-2 rounded-md">
          <p className="text-xs text-[var(--color-loss)] font-bold">Safety Freeze</p>
          <button onClick={() => window.api.invoke(IPC.AGENT_RESET_FREEZE)} className="text-[10px] underline text-[var(--color-loss)] mt-1">Reset</button>
        </div>
      )}
      
      {leaderboard.length > 0 && (
        <div className="mt-6 w-full max-w-[340px] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <p className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase mb-2">
            Portfolio Ranking
          </p>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={entry.symbol} className="flex items-center justify-between rounded-lg bg-[var(--bg-inset)] px-3 py-2">
                <div>
                  <p className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {index + 1}. {entry.symbol}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {entry.reason}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                    {(entry.winRate * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {entry.sampleSize} trades
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center pointer-events-none w-[320px]">
        <p
          className={`text-[12px] font-semibold ${
            normalizedError
              ? "text-[var(--color-loss)]"
              : !isRunning
              ? "text-[var(--text-secondary)]"
              : agentStatus.frozen
                ? "text-[var(--color-loss)]"
                : "text-[var(--color-profit)]"
          }`}
        >
          {statusTitle}
        </p>
        <div className={`mt-1 flex items-center justify-center gap-1 agent-status-dots agent-status-dots--${statusDotState}`}>
          <span className="agent-status-dot" />
          <span className="agent-status-dot" style={{ animationDelay: "0.15s" }} />
          <span className="agent-status-dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{statusDetail}</p>
      </div>

      <AgentConfigModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  );
}
