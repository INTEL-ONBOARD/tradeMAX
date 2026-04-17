import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { BarChart2, Bot, User, Download, Search } from "./icons";

interface TradeRow {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  source: string;
  pnl: number | null;
  status: string;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  time: string;
}

function exportToCSV(trades: TradeRow[]) {
  const headers = ["Date", "Symbol", "Side", "Entry", "Exit", "Qty", "PnL", "Status", "Source"];
  const rows = trades.map(t => [
    t.time,
    t.symbol,
    t.side,
    t.entryPrice.toFixed(2),
    t.exitPrice?.toFixed(2) ?? "",
    t.quantity.toFixed(6),
    t.pnl?.toFixed(2) ?? "",
    t.status,
    t.source,
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trademax-trades-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TradesPanel() {
  const agentTrades = useAppStore((s) => s.trades);
  const exchangeHistory = useAppStore((s) => s.exchangeHistory);

  // Merge agent trades (local DB) + exchange history (Bybit API), sorted newest first
  const allTrades = useMemo<TradeRow[]>(() => {
    const fromAgent: TradeRow[] = agentTrades.map((t) => ({
      id: t._id,
      symbol: t.symbol,
      side: t.side,
      source: t.source,
      pnl: t.pnl,
      status: t.status,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      time: t.closedAt || t.createdAt,
    }));
    const fromExchange: TradeRow[] = exchangeHistory.map((t, i) => ({
      id: `ex-${i}`,
      symbol: t.symbol,
      side: t.side,
      source: "EXCHANGE",
      pnl: t.pnl,
      status: "CLOSED",
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      quantity: t.quantity,
      time: t.closedAt,
    }));
    // Deduplicate: if agent trade matches exchange trade (same symbol, similar time), keep agent version
    const agentKeys = new Set(fromAgent.map((t) => `${t.symbol}-${Math.floor(new Date(t.time).getTime() / 5000)}`));
    const unique = fromExchange.filter((t) => !agentKeys.has(`${t.symbol}-${Math.floor(new Date(t.time).getTime() / 5000)}`));
    return [...fromAgent, ...unique].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [agentTrades, exchangeHistory]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTrades = useMemo(() => {
    return allTrades.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (sideFilter !== "all" && t.side !== sideFilter) return false;
      if (searchTerm && !t.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (dateFrom && new Date(t.time) < new Date(dateFrom)) return false;
      if (dateTo && new Date(t.time) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [allTrades, statusFilter, sideFilter, searchTerm, dateFrom, dateTo]);

  const selectClass = "px-2 py-1 text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--color-info)] transition-colors";
  const inputClass = "px-2 py-1 text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--color-info)] transition-colors";

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-[var(--text-tertiary)]" />
          <span className="section-label">Recent Trades</span>
        </div>
        <span className="badge-neutral">
          {filteredTrades.length}{filteredTrades.length !== allTrades.length ? ` / ${allTrades.length}` : ""}
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Status</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select value={sideFilter} onChange={e => setSideFilter(e.target.value)} className={selectClass}>
          <option value="all">All Sides</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} style={{ width: 110 }} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} style={{ width: 110 }} />

        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Symbol..." className={`${inputClass} pl-6`} style={{ width: 100 }} />
        </div>

        <button
          onClick={() => exportToCSV(filteredTrades)}
          disabled={filteredTrades.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-medium uppercase tracking-wider rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--color-info)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Download size={10} />
          Export CSV
        </button>
      </div>

      {allTrades.length === 0 ? (
        <div className="py-8 text-center">
          <BarChart2 size={28} className="text-[var(--text-tertiary)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-tertiary)]">No trades yet</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">Executed trades will appear here</p>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="py-6 text-center">
          <Search size={22} className="text-[var(--text-tertiary)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--text-tertiary)]">No trades match filters</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">Try adjusting your filter criteria</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {filteredTrades.map((t, i) => {
                const pnl = t.pnl ?? 0;
                const isProfitable = pnl >= 0;
                return (
                  <motion.tr
                    key={t.id}
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
                        t.source === "AI" ? "text-[var(--color-info)]" : t.source === "EXCHANGE" ? "text-[var(--text-secondary)]" : "text-[var(--text-secondary)]"
                      }`}>
                        {t.source === "AI" ? <Bot size={10} /> : <User size={10} />}
                        {t.source}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-mono font-semibold ${
                      t.pnl !== null ? (isProfitable ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]") : "text-[var(--text-tertiary)]"
                    }`}>
                      {t.pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5">
                      <span className={t.status === "OPEN" ? "badge-info" : "badge-neutral"}>{t.status}</span>
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-tertiary)] font-mono">
                      {new Date(t.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
