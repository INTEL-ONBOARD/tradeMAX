import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Layers } from "./icons";

export function PositionsPanel() {
  const positions = useAppStore((s) => s.positions);
  const [confirmingCloseAll, setConfirmingCloseAll] = useState(false);

  const handleCloseAll = async () => {
    if (!confirmingCloseAll) {
      setConfirmingCloseAll(true);
      setTimeout(() => setConfirmingCloseAll(false), 5000);
      return;
    }
    try {
      await window.api.invoke(IPC.AGENT_KILL_SWITCH);
    } catch (err) {
      console.error("Kill switch failed:", err);
    }
    setConfirmingCloseAll(false);
  };

  return (
    <div className="w-full">
      {/* Top Banner mapping to the "5 device drivers outdated" banner */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-sm p-4 mb-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-warn)] flex items-center justify-center text-[var(--bg-base)] font-bold text-lg shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            !
          </div>
          <span className="text-[14px] text-[var(--color-warn)] font-medium">
             {positions.length} active trade positions <span className="text-[var(--text-primary)] font-normal">tracking real-time market data</span>
          </span>
        </div>
        <button
          onClick={handleCloseAll}
          className={`${confirmingCloseAll ? "bg-red-700 animate-pulse" : "bg-[var(--color-loss)]"} text-white px-6 py-2 rounded-sm text-xs font-semibold hover:bg-rose-600 transition-colors shadow`}
        >
          {confirmingCloseAll ? "Confirm Close All?" : "Close All"}
        </button>
      </div>

      {/* Upgrade Banner mapping */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-sm p-3 mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[var(--color-loss)] flex items-center justify-center shadow">
             <Layers size={16} className="text-white" />
          </div>
          <span className="text-[13px] text-[var(--text-secondary)]">
            Upgrade to <span className="font-bold text-[var(--text-primary)]">PRO edition</span> to enable unlimited concurrent trading pairs.
          </span>
        </div>
        <button className="bg-[var(--color-warn)] text-white px-6 py-1.5 rounded-sm text-xs font-medium hover:brightness-110 transition-all shadow">
          Upgrade
        </button>
      </div>

      {/* List Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-[var(--border-strong)]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">Active (total: {positions.length})</span>
        </div>
      </div>

      {/* Rows */}
      {positions.length === 0 ? (
        <div className="p-8 text-center text-[var(--text-tertiary)] text-xs">No active positions</div>
      ) : (
        <div className="flex flex-col">
          {positions.map((p, i) => (
            <motion.div
              key={`${p.symbol}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 border-b border-[var(--border)] hover:bg-[var(--bg-overlay)] transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-inset)] flex items-center justify-center">
                  <span className={`text-[10px] font-bold ${p.side === "BUY" ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
                    {p.side}
                  </span>
                </div>

                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] tracking-wide">{p.symbol}</p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                     PnL: <span className={p.unrealizedPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}>
                       {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(2)}
                     </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="hidden md:block text-right">
                   <p className="text-[10px] text-[var(--text-tertiary)] font-mono">Entry: {p.entryPrice.toLocaleString()}</p>
                   <p className="text-[10px] text-[var(--color-info)] font-mono mt-0.5">Mark: {p.markPrice.toLocaleString()}</p>
                </div>
                
                <button
                  disabled
                  title="Close via exchange"
                  className="flex items-center gap-3 px-6 py-1.5 bg-[var(--bg-inset)] border border-[var(--border-strong)] text-[var(--text-tertiary)] text-xs font-medium rounded-sm cursor-not-allowed opacity-60"
                >
                  Close
                </button>
              </div>
            </motion.div>
          ))}
          
          <div className="mt-2 text-xs text-[var(--text-tertiary)] opacity-50 px-2 pb-6">
             Closed (Recent 50)
          </div>
        </div>
      )}
    </div>
  );
}
