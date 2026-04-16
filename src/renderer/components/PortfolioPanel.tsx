import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { Wallet, TrendingUp, TrendingDown, Activity } from "./icons";

export function PortfolioPanel() {
  const portfolio = useAppStore((s) => s.portfolio);
  const marketTick = useAppStore((s) => s.marketTick);

  const dailyPnl = portfolio?.dailyPnl ?? 0;
  const isProfitable = dailyPnl >= 0;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <Wallet size={12} className="text-[var(--text-tertiary)]" />
        <span className="section-label">Portfolio</span>
      </div>

      {/* Total Balance */}
      <div className="mb-3">
        <p className="text-[11px] text-[var(--text-tertiary)] mb-0.5">Total Balance</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={portfolio?.totalBalance}
            initial={{ opacity: 0.5, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            ${(portfolio?.totalBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[var(--bg-inset)] rounded-lg p-2.5">
          <p className="text-[10px] text-[var(--text-tertiary)] mb-1">Available</p>
          <p className="text-sm font-mono font-semibold text-[var(--text-primary)]">
            ${(portfolio?.availableBalance ?? 0).toFixed(2)}
          </p>
        </div>

        <div className={`rounded-lg p-2.5 ${isProfitable ? "bg-[var(--color-profit-bg)]" : "bg-[var(--color-loss-bg)]"}`}>
          <div className="flex items-center gap-1 mb-1">
            {isProfitable
              ? <TrendingUp size={10} className="text-[var(--color-profit)]" />
              : <TrendingDown size={10} className="text-[var(--color-loss)]" />
            }
            <p className="text-[10px] text-[var(--text-tertiary)]">Daily PnL</p>
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={dailyPnl}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-sm font-mono font-semibold ${isProfitable ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}
            >
              {isProfitable ? "+" : ""}{dailyPnl.toFixed(2)}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Live Ticker */}
      {marketTick && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between"
        >
          <div className="flex items-center gap-1.5">
            <Activity size={11} className="text-[var(--color-profit)]" />
            <span className="text-[11px] text-[var(--text-secondary)] font-mono">{marketTick.symbol}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={marketTick.price}
              initial={{ opacity: 0.5, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-sm font-mono font-semibold text-[var(--color-info)]"
            >
              ${marketTick.price.toLocaleString()}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}
    </Card>
  );
}
