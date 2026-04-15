import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function PositionsPanel() {
  const positions = useAppStore((s) => s.positions);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Live Positions</h3>

      {positions.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No open positions</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                <th className="pb-2 text-left">Symbol</th>
                <th className="pb-2 text-left">Side</th>
                <th className="pb-2 text-right">Entry</th>
                <th className="pb-2 text-right">Mark</th>
                <th className="pb-2 text-right">PnL</th>
                <th className="pb-2 text-right">Liq.</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.symbol}-${i}`} className="border-b border-[var(--border)]/50">
                  <td className="py-2 font-mono">{p.symbol}</td>
                  <td className={`py-2 font-bold ${p.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{p.side}</td>
                  <td className="py-2 text-right font-mono">{p.entryPrice.toLocaleString()}</td>
                  <td className="py-2 text-right font-mono">{p.markPrice.toLocaleString()}</td>
                  <td className={`py-2 text-right font-mono ${p.unrealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                    {p.liquidationPrice ? p.liquidationPrice.toLocaleString() : "—"}
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
