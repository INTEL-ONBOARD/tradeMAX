import { useRef, useState } from "react";
import { Modal } from "./Modal";
import type { BacktestResult } from "../../shared/types";

function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const tension = 0.3;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  result: BacktestResult | null;
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]">
      <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{label}</span>
      <span className="text-sm font-bold font-mono" style={{ color: color ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function BacktestResultsModal({ isOpen, onClose, result }: Props) {
  if (!result) return null;

  const isProfitable = result.totalPnl >= 0;
  const pnlColor = isProfitable ? "var(--color-profit)" : "var(--color-loss)";

  // Build equity curve from trades
  const equityPoints = [result.startingBalance];
  let cum = result.startingBalance;
  for (const t of result.trades) {
    cum += t.pnl;
    equityPoints.push(cum);
  }

  const W = 560;
  const H = 140;
  const padT = 10;
  const padB = 10;
  const min = Math.min(...equityPoints) * 0.999;
  const max = Math.max(...equityPoints) * 1.001;
  const range = max - min || 1;

  const points = equityPoints.map((val, i) => ({
    x: (i / Math.max(equityPoints.length - 1, 1)) * W,
    y: padT + (1 - (val - min) / range) * (H - padT - padB),
  }));

  const linePath = catmullRomPath(points);
  const areaPath = points.length >= 2
    ? `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`
    : "";
  const chartColor = isProfitable ? "var(--color-profit)" : "var(--color-loss)";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Backtest: ${result.symbol} - ${result.period}`} width="720px" height="640px">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="Starting" value={`$${fmt(result.startingBalance)}`} />
          <StatBox label="Final" value={`$${fmt(result.finalBalance)}`} color={pnlColor} />
          <StatBox label="Total PnL" value={`${isProfitable ? "+" : ""}$${fmt(result.totalPnl)}`} color={pnlColor} />
          <StatBox label="Win Rate" value={`${fmt(result.winRate, 1)}%`} color={result.winRate >= 50 ? "var(--color-profit)" : "var(--color-loss)"} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Sharpe Ratio" value={fmt(result.sharpeRatio)} />
          <StatBox label="Max Drawdown" value={`${fmt(result.maxDrawdown, 1)}%`} color="var(--color-loss)" />
          <StatBox label="Profit Factor" value={fmt(result.profitFactor)} color={result.profitFactor >= 1 ? "var(--color-profit)" : "var(--color-loss)"} />
        </div>

        {/* Equity curve */}
        {equityPoints.length >= 2 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Equity Curve</p>
            <svg width="100%" height="140" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((r) => (
                <line key={r} x1={0} y1={padT + r * (H - padT - padB)} x2={W} y2={padT + r * (H - padT - padB)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 6" />
              ))}
              <path d={areaPath} fill="url(#btGrad)" />
              <path d={linePath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Trade list */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Trades ({result.totalTrades})</p>
          </div>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-tertiary)] text-[10px] uppercase border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left font-medium">Side</th>
                  <th className="px-3 py-2 text-right font-medium">Entry</th>
                  <th className="px-3 py-2 text-right font-medium">Exit</th>
                  <th className="px-3 py-2 text-right font-medium">PnL</th>
                  <th className="px-3 py-2 text-left font-medium">Reason</th>
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-overlay)] transition-colors">
                    <td className="px-3 py-1.5">
                      <span className={`font-bold ${t.side === "BUY" ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>{t.side}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">${fmt(t.entryPrice)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">${fmt(t.exitPrice)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${t.pnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
                      {t.pnl >= 0 ? "+" : ""}${fmt(t.pnl)}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--text-tertiary)]">{t.reason.replace("_", " ")}</td>
                    <td className="px-3 py-1.5 text-[var(--text-tertiary)]">{new Date(t.entryTime).toLocaleDateString()}</td>
                  </tr>
                ))}
                {result.trades.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-[var(--text-tertiary)]">No trades executed</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
