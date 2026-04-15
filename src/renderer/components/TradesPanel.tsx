import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { Trade } from "../../shared/types";

export function TradesPanel() {
  const trades = useAppStore((s) => s.trades);
  const setTrades = useAppStore((s) => s.setTrades);

  useEffect(() => {
    window.api.invoke(IPC.TRADES_HISTORY, { limit: 50 }).then((data) => {
      setTrades(data as Trade[]);
    });
  }, []);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Recent Trades</h3>

      {trades.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No trades yet</p>
      ) : (
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--bg-primary)]">
              <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="pb-2 text-left">Symbol</th>
                <th className="pb-2 text-left">Side</th>
                <th className="pb-2 text-right">PnL</th>
                <th className="pb-2 text-left">Source</th>
                <th className="pb-2 text-left">Status</th>
                <th className="pb-2 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t._id} className="border-b border-[var(--border)]/50">
                  <td className="py-2 font-mono">{t.symbol}</td>
                  <td className={`py-2 font-bold ${t.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.side}</td>
                  <td className={`py-2 text-right font-mono ${(t.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.source === "AI" ? "bg-primary/20 text-primary" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}>
                      {t.source}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.status === "OPEN" ? "bg-accent/20 text-accent" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">
                    {new Date(t.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
