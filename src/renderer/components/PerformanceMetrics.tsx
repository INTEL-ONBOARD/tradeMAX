import { useAppStore } from "../store/appStore";

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3 flex flex-col">
      <span className="text-[9px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] mb-1">{label}</span>
      <span className="text-sm font-mono font-bold" style={{ color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

interface PerformanceMetricsProps {
  filter?: string;
}

export function PerformanceMetrics({ filter = "ALL" }: PerformanceMetricsProps) {
  const exchangeHistory = useAppStore((s) => s.exchangeHistory);

  // Filter by time range
  const now = Date.now();
  const filterMs: Record<string, number> = {
    "1H": 3600_000,
    "4H": 4 * 3600_000,
    "1D": 86400_000,
    "1W": 7 * 86400_000,
    "1M": 30 * 86400_000,
  };
  const cutoff = filterMs[filter] ? now - filterMs[filter] : 0;

  const closedTrades = exchangeHistory.filter(
    (t) => new Date(t.closedAt).getTime() >= cutoff
  );

  if (closedTrades.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg">
        <p className="text-xs text-[var(--text-tertiary)]">
          {exchangeHistory.length === 0 ? "No closed trades yet" : `No trades in ${filter} window`}
        </p>
      </div>
    );
  }

  const wins = closedTrades.filter((t) => t.pnl > 0);
  const losses = closedTrades.filter((t) => t.pnl < 0);
  const winRate = (wins.length / closedTrades.length) * 100;
  const totalPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const avgPnl = totalPnl / closedTrades.length;
  const bestTrade = Math.max(...closedTrades.map((t) => t.pnl));
  const worstTrade = Math.min(...closedTrades.map((t) => t.pnl));
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  let peak = 0;
  let maxDD = 0;
  let cumPnl = 0;
  for (const t of closedTrades) {
    cumPnl += t.pnl;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  }

  const returns = closedTrades.map((t) => t.pnl);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  const avgTradeSize =
    closedTrades.reduce((s, t) => s + t.quantity * t.entryPrice, 0) / closedTrades.length;

  const fmt = (n: number) => n >= 0 ? `+$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`;
  const profitColor = "var(--color-profit)";
  const lossColor = "var(--color-loss)";

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCard label="Win Rate" value={`${winRate.toFixed(1)}%`} color={winRate >= 50 ? profitColor : lossColor} />
      <StatCard label="Total Trades" value={closedTrades.length.toString()} />
      <StatCard label="Best Trade" value={fmt(bestTrade)} color={profitColor} />
      <StatCard label="Worst Trade" value={fmt(worstTrade)} color={lossColor} />
      <StatCard label="Avg PnL" value={fmt(avgPnl)} color={avgPnl >= 0 ? profitColor : lossColor} />
      <StatCard label="Profit Factor" value={profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)} color={profitFactor >= 1 ? profitColor : lossColor} />
      <StatCard label="Max Drawdown" value={`$${maxDD.toFixed(2)}`} color={lossColor} />
      <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} color={sharpe >= 1 ? profitColor : sharpe >= 0 ? "var(--text-primary)" : lossColor} />
      <StatCard label="Avg Trade Size" value={`$${avgTradeSize.toFixed(2)}`} />
    </div>
  );
}
