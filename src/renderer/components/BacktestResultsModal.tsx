import type { ReactNode } from "react";
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

function fmtPct(n: number, decimals = 1): string {
  return `${fmt(n, decimals)}%`;
}

function fmtSignedMoney(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${fmt(Math.abs(n))}`;
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

function Section({ title, children, subtitle }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{title}</p>
            {subtitle && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-3">
        {children}
      </div>
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
    <Modal isOpen={isOpen} onClose={onClose} title={`Backtest: ${result.symbol} - ${result.period}`} width="780px" height="720px">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatBox label="Starting" value={`$${fmt(result.startingBalance)}`} />
          <StatBox label="Final" value={`$${fmt(result.finalBalance)}`} color={pnlColor} />
          <StatBox label="Total PnL" value={fmtSignedMoney(result.totalPnl)} color={pnlColor} />
          <StatBox label="Win Rate" value={fmtPct(result.winRate)} color={result.winRate >= 50 ? "var(--color-profit)" : "var(--color-loss)"} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatBox label="Sharpe" value={fmt(result.sharpeRatio)} />
          <StatBox label="Sortino" value={fmt(result.sortinoRatio)} />
          <StatBox label="Profit Factor" value={fmt(result.profitFactor)} color={result.profitFactor >= 1 ? "var(--color-profit)" : "var(--color-loss)"} />
          <StatBox label="Max Drawdown" value={fmtPct(result.maxDrawdown)} color="var(--color-loss)" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatBox label="Expectancy" value={fmtSignedMoney(result.expectancy)} />
          <StatBox label="Avg Adverse Exc." value={fmtPct(result.averageAdverseExcursion)} />
          <StatBox label="AI Rejection" value={fmtPct(result.aiRejectionRate)} />
          <StatBox label="Avg Latency" value={`${fmt(result.averageLatencyMs, 0)} ms`} />
        </div>

        {result.walkForward && (
          <Section
            title="Walk-Forward Sweep"
            subtitle={result.walkForward.bestProfileReason}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[11px] text-[var(--text-secondary)]">
                Best profile: <span className="font-semibold text-[var(--text-primary)]">{result.walkForward.bestProfile}</span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                {result.walkForward.sweepProfiles.join(" / ")}
              </div>
            </div>

            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-tertiary)] text-[10px] uppercase border-b border-[var(--border)]">
                    <th className="px-3 py-2 text-left font-medium">Profile</th>
                    <th className="px-3 py-2 text-right font-medium">Trades</th>
                    <th className="px-3 py-2 text-right font-medium">PnL</th>
                    <th className="px-3 py-2 text-right font-medium">PF</th>
                    <th className="px-3 py-2 text-right font-medium">DD</th>
                    <th className="px-3 py-2 text-right font-medium">Sharpe</th>
                    <th className="px-3 py-2 text-right font-medium">Sortino</th>
                    <th className="px-3 py-2 text-right font-medium">Rej%</th>
                  </tr>
                </thead>
                <tbody>
                  {result.walkForward.profileResults.map((row) => (
                    <tr key={row.profile} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-1.5 font-medium text-[var(--text-primary)]">{row.profile}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.totalTrades}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-bold ${row.totalPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
                        {fmtSignedMoney(row.totalPnl)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(row.profitFactor)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmtPct(row.maxDrawdown)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(row.sharpeRatio)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(row.sortinoRatio)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmtPct(row.aiRejectionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--text-tertiary)] text-[10px] uppercase border-b border-[var(--border)]">
                    <th className="px-3 py-2 text-left font-medium">Profile</th>
                    <th className="px-3 py-2 text-right font-medium">Fold</th>
                    <th className="px-3 py-2 text-left font-medium">Train</th>
                    <th className="px-3 py-2 text-left font-medium">Test</th>
                    <th className="px-3 py-2 text-right font-medium">Trades</th>
                    <th className="px-3 py-2 text-right font-medium">PnL</th>
                    <th className="px-3 py-2 text-right font-medium">PF</th>
                    <th className="px-3 py-2 text-right font-medium">DD</th>
                  </tr>
                </thead>
                <tbody>
                  {result.walkForward.folds.map((fold, index) => (
                    <tr key={`${fold.profile}-${fold.fold}-${index}`} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-1.5 font-medium text-[var(--text-primary)]">{fold.profile}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fold.fold}</td>
                      <td className="px-3 py-1.5 text-[var(--text-tertiary)] whitespace-nowrap">{fold.trainPeriod}</td>
                      <td className="px-3 py-1.5 text-[var(--text-tertiary)] whitespace-nowrap">{fold.testPeriod}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fold.totalTrades}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-bold ${fold.totalPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
                        {fmtSignedMoney(fold.totalPnl)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(fold.profitFactor)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmtPct(fold.maxDrawdown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section title="Regime Breakdown" subtitle="Performance by market regime from the replay snapshots">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-tertiary)] text-[10px] uppercase border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left font-medium">Regime</th>
                  <th className="px-3 py-2 text-right font-medium">Trades</th>
                  <th className="px-3 py-2 text-right font-medium">Win Rate</th>
                  <th className="px-3 py-2 text-right font-medium">PnL</th>
                  <th className="px-3 py-2 text-right font-medium">PF</th>
                  <th className="px-3 py-2 text-right font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {result.regimeBreakdown.map((row) => (
                  <tr key={row.regime} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-3 py-1.5 font-medium text-[var(--text-primary)]">{row.regime.replace(/_/g, " ")}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.trades}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmtPct(row.winRate)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${row.totalPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
                      {fmtSignedMoney(row.totalPnl)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(row.profitFactor)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[var(--text-secondary)]">{fmt(row.averageLatencyMs, 0)} ms</td>
                  </tr>
                ))}
                {result.regimeBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-[var(--text-tertiary)]">No regime breakdown available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Equity curve */}
        {equityPoints.length >= 2 && (
          <Section title="Equity Curve" subtitle="Cumulative equity across closed trades">
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
          </Section>
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
                      {fmtSignedMoney(t.pnl)}
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
