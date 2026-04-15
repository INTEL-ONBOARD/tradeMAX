import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function PortfolioPanel() {
  const portfolio = useAppStore((s) => s.portfolio);
  const marketTick = useAppStore((s) => s.marketTick);

  return (
    <GlassCard className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Portfolio</h3>

      <div className="text-xl font-bold">
        ${portfolio?.totalBalance?.toFixed(2) ?? "0.00"}
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Available</span>
        <span>${portfolio?.availableBalance?.toFixed(2) ?? "0.00"}</span>
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">Daily PnL</span>
        <span className={portfolio?.dailyPnl && portfolio.dailyPnl >= 0 ? "text-green-400" : "text-red-400"}>
          {portfolio?.dailyPnl !== undefined ? (portfolio.dailyPnl >= 0 ? "+" : "") + portfolio.dailyPnl.toFixed(2) : "0.00"}
        </span>
      </div>

      {marketTick && (
        <div className="flex justify-between text-xs mt-1 pt-1 border-t border-[var(--border)]">
          <span className="text-[var(--text-secondary)]">{marketTick.symbol}</span>
          <span className="text-accent font-mono">${marketTick.price.toLocaleString()}</span>
        </div>
      )}
    </GlassCard>
  );
}
