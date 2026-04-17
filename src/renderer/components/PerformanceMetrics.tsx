import { useAppStore } from "../store/appStore";

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 flex flex-col">
      <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] mb-1">{label}</span>
      <span className="text-sm font-mono font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function PerformanceMetrics() {
  const trades = useAppStore((s) => s.trades);
  const closedTrades = trades.filter((t) => t.status === "CLOSED" && t.pnl !== null);

  if (closedTrades.length === 0) {
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-4 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">No closed trades yet</p>
      </div>
    );
  }

  const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closedTrades.filter((t) => (t.pnl ?? 0) < 0);
  const winRate = (wins.length / closedTrades.length) * 100;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const avgPnl = totalPnl / closedTrades.length;
  const bestTrade = Math.max(...closedTrades.map((t) => t.pnl ?? 0));
  const worstTrade = Math.min(...closedTrades.map((t) => t.pnl ?? 0));
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let peak = 0;
  let maxDD = 0;
  let cumPnl = 0;
  for (const t of closedTrades) {
    cumPnl += t.pnl ?? 0;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  }

  const returns = closedTrades.map((t) => t.pnl ?? 0);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  const fmt = (n: number) => n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
  const profitColor = "var(--color-profit)";
  const lossColor = "var(--color-loss)";

  return (
    <div className="grid grid-cols-4 gap-2">
      <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? profitColor : lossColor} />
      <StatCard label="Total Trades" value={closedTrades.length.toString()} />
      <StatCard label="Best Trade" value={fmt(bestTrade)} color={profitColor} />
      <StatCard label="Worst Trade" value={fmt(worstTrade)} color={lossColor} />
      <StatCard label="Avg PnL" value={fmt(avgPnl)} color={avgPnl >= 0 ? profitColor : lossColor} />
      <StatCard label="Profit Factor" value={profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)} color={profitFactor >= 1 ? profitColor : lossColor} />
      <StatCard label="Max Drawdown" value={`$${maxDD.toFixed(2)}`} color={lossColor} />
      <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} color={sharpe >= 1 ? profitColor : sharpe >= 0 ? "var(--text-primary)" : lossColor} />
    </div>
  );
}
