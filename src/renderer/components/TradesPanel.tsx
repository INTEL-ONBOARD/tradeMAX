import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { Trade } from "../../shared/types";
import { BarChart2, Bot, User } from "./icons";

export function TradesPanel() {
  const trades = useAppStore((s) => s.trades);
  const setTrades = useAppStore((s) => s.setTrades);

  useEffect(() => {
    window.api.invoke(IPC.TRADES_HISTORY, { limit: 50 }).then((data) => {
      setTrades(data as Trade[]);
    });
  }, []);

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-[var(--text-tertiary)]" />
          <span className="section-label">Recent Trades</span>
        </div>
        <span className="badge-neutral">{trades.length}</span>
      </div>

      {trades.length === 0 ? (
        <div className="py-8 text-center">
          <BarChart2 size={28} className="text-[var(--text-tertiary)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-tertiary)]">No trades yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">Executed trades will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ background: "var(--bg-surface)" }}>
              <tr className="border-b border-[var(--border)]">
                {["Symbol", "Side", "Source", "PnL", "Status", "Time"].map((h) => (
                  <th
                    key={h}
                    className={`pb-2.5 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider ${
                      ["PnL", "Time"].includes(h) ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const pnl = t.pnl ?? 0;
                const isProfitable = pnl >= 0;
                return (
                  <motion.tr
                    key={t._id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="border-b border-[var(--border)]/40 hover:bg-[var(--bg-overlay)] transition-colors"
                  >
                    <td className="py-2.5 font-mono font-medium text-[var(--text-primary)]">{t.symbol}</td>
                    <td className="py-2.5">
                      <span className={t.side === "BUY" ? "badge-profit" : "badge-loss"}>{t.side}</span>
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] ${
                        t.source === "AI" ? "text-[var(--color-info)]" : "text-[var(--text-secondary)]"
                      }`}>
                        {t.source === "AI" ? <Bot size={10} /> : <User size={10} />}
                        {t.source}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-mono font-semibold ${
                      t.pnl !== null
                        ? isProfitable ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"
                        : "text-[var(--text-tertiary)]"
                    }`}>
                      {t.pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5">
                      <span className={
                        t.status === "OPEN" ? "badge-info" :
                        t.status === "CLOSED" ? "badge-neutral" :
                        "badge-warn"
                      }>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-tertiary)] font-mono">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
