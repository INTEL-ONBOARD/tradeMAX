import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import { TrendingUp, TrendingDown } from "./icons";
import { EquityCurveChart } from "./EquityCurveChart";
import { PerformanceMetrics } from "./PerformanceMetrics";

const TIME_FILTERS = ["1H", "4H", "1D", "1W", "1M", "ALL"] as const;

const generateInitialData = (count: number, currentBalance: number) => {
  const data: number[] = [];
  // Initialize with current balance for all points
  for (let i = 0; i < count; i++) {
    data.push(currentBalance);
  }
  return data;
};

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

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg p-3 border border-[var(--border)] bg-[var(--bg-surface)]">
      <p className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-sm font-mono font-bold ${color ?? "text-[var(--text-primary)]"}`}>{value}</p>
      {sub && <p className="text-[9px] text-[var(--text-tertiary)] font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

export function PortfolioModalContent() {
  const portfolio = useAppStore((s) => s.portfolio);
  const trades = useAppStore((s) => s.trades);
  const positions = useAppStore((s) => s.positions);

  const dailyPnl = portfolio?.dailyPnl ?? 0;
  const isProfitable = dailyPnl >= 0;
  const totalBalance = portfolio?.totalBalance ?? 0;

  const [activeFilter, setActiveFilter] = useState<typeof TIME_FILTERS[number]>("1D");
  const [chartData, setChartData] = useState<number[]>(generateInitialData(60, totalBalance));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Regenerate data when filter changes
  useEffect(() => {
    const counts: Record<string, number> = { "1H": 30, "4H": 48, "1D": 60, "1W": 70, "1M": 90, ALL: 120 };
    setChartData(generateInitialData(counts[activeFilter] ?? 60, totalBalance));
  }, [activeFilter]);

  // Update chart with real portfolio balance changes
  useEffect(() => {
    setChartData((prev) => {
      // If the latest value is different from current balance, add new data point
      const lastVal = prev[prev.length - 1];
      if (Math.abs(lastVal - totalBalance) > 0.01) {
        return [...prev.slice(1), totalBalance];
      }
      return prev;
    });
  }, [totalBalance]);

  // Chart geometry
  const W = 700;
  const H = 200;
  const padT = 20;
  const padB = 10;
  const min = Math.min(...chartData);
  const max = Math.max(...chartData);
  const range = max - min || 1;

  const points = chartData.map((val, i) => ({
    x: (i / (chartData.length - 1)) * W,
    y: padT + (1 - (val - min) / range) * (H - padT - padB),
  }));

  const linePath = catmullRomPath(points);
  const lastPt = points[points.length - 1];
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;
  const chartColor = isProfitable ? "var(--color-profit)" : "var(--color-loss)";

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((x / W) * (chartData.length - 1));
    setHoveredIdx(Math.max(0, Math.min(idx, chartData.length - 1)));
  };

  const hoveredPt = hoveredIdx !== null ? points[hoveredIdx] : null;
  const hoveredVal = hoveredIdx !== null ? chartData[hoveredIdx] : null;

  // Convert viewBox coordinates to pixel position relative to the container
  const toPixel = (vx: number, vy: number) => {
    const el = chartContainerRef.current;
    if (!el) return { px: 0, py: 0 };
    const rect = el.getBoundingClientRect();
    return {
      px: (vx / W) * rect.width,
      py: (vy / H) * rect.height,
    };
  };

  // Computed stats
  const availableBalance = portfolio?.availableBalance ?? 0;
  const winCount = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const totalClosed = trades.filter((t) => t.status === "CLOSED").length;
  const winRate = totalClosed > 0 ? ((winCount / totalClosed) * 100).toFixed(1) : "—";
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const chartMin = min.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const chartMax = max.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar: balance + filters */}
      <div className="flex items-end justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]" style={{ background: "var(--bg-surface)" }}>
        <div>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-0.5">
            Total Balance
          </p>
          <AnimatePresence mode="wait">
            <motion.span
              key={totalBalance}
              initial={{ opacity: 0.5, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight text-[var(--text-primary)]"
            >
              ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.span>
          </AnimatePresence>
          <div className="flex items-center gap-1.5 mt-1">
            {isProfitable ? (
              <TrendingUp size={12} className="text-[var(--color-profit)]" />
            ) : (
              <TrendingDown size={12} className="text-[var(--color-loss)]" />
            )}
            <span className={`text-xs font-mono font-bold ${isProfitable ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}`}>
              {isProfitable ? "+" : ""}{dailyPnl.toFixed(2)} today
            </span>
          </div>
        </div>

        {/* Time filters */}
        <div className="flex items-center gap-1 rounded-lg p-0.5 border border-[var(--border)] bg-[var(--bg-base)]">
          {TIME_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider transition-all ${
                activeFilter === f
                  ? "bg-[var(--color-loss)] text-white"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 px-5 pt-3 flex flex-col">
        {/* Y-axis labels */}
        <div className="flex justify-between mb-1 px-1">
          <span className="text-[9px] font-mono text-[var(--text-tertiary)]">${chartMax}</span>
        </div>

        {/* SVG + overlays share same relative container (no padding mismatch) */}
        <div className="relative flex-1 min-h-0" ref={chartContainerRef}>
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full overflow-visible cursor-crosshair"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="modalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                <stop offset="60%" stopColor={chartColor} stopOpacity={0.05} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
              <filter id="modalGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid lines */}
            {[0.2, 0.4, 0.6, 0.8].map((r) => (
              <line
                key={r}
                x1={0} y1={padT + r * (H - padT - padB)} x2={W} y2={padT + r * (H - padT - padB)}
                stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 8"
              />
            ))}

            <path d={areaPath} fill="url(#modalAreaGrad)" />
            <path d={linePath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#modalGlow)" />
          </svg>

          {/* Hover crosshair + dot — positioned with % matching the SVG viewBox exactly */}
          {hoveredPt && (
            <>
              <div
                className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
                style={{
                  left: `${(hoveredPt.x / W) * 100}%`,
                  backgroundImage: "repeating-linear-gradient(to bottom, var(--text-tertiary) 0px, var(--text-tertiary) 3px, transparent 3px, transparent 6px)",
                  opacity: 0.4,
                }}
              />
              <div
                className="absolute left-0 right-0 h-px pointer-events-none z-10"
                style={{
                  top: `${(hoveredPt.y / H) * 100}%`,
                  backgroundImage: "repeating-linear-gradient(to right, var(--text-tertiary) 0px, var(--text-tertiary) 3px, transparent 3px, transparent 6px)",
                  opacity: 0.3,
                }}
              />
              <div
                className="absolute w-3 h-3 rounded-full pointer-events-none z-10"
                style={{
                  left: `${(hoveredPt.x / W) * 100}%`,
                  top: `${(hoveredPt.y / H) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  background: chartColor,
                  boxShadow: `0 0 0 3px var(--bg-base), 0 0 10px ${chartColor}`,
                }}
              />
            </>
          )}

          {/* Live pulse dot */}
          {!hoveredPt && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${(lastPt.x / W) * 100}%`,
                top: `${(lastPt.y / H) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <span
                className="absolute rounded-full animate-ping"
                style={{
                  background: chartColor,
                  opacity: 0.3,
                  width: 20,
                  height: 20,
                  top: -6,
                  left: -6,
                }}
              />
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: chartColor,
                  boxShadow: `0 0 0 2.5px var(--bg-base), 0 0 10px ${chartColor}`,
                }}
              />
            </div>
          )}

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredPt && hoveredVal !== null && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-2 right-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-mono font-bold text-[var(--text-primary)] z-20"
                style={{ background: "var(--bg-overlay)" }}
              >
                ${hoveredVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex justify-between mt-1 px-1">
          <span className="text-[9px] font-mono text-[var(--text-tertiary)]">${chartMin}</span>
        </div>
      </div>

      {/* Equity Curve + Performance — side by side */}
      <div className="grid grid-cols-2 gap-4 px-5 pt-3 pb-1">
        <div>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-2">Equity Curve</p>
          <EquityCurveChart />
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-medium mb-2">Performance</p>
          <PerformanceMetrics />
        </div>
      </div>

      {/* Bottom stats grid */}
      <div className="grid grid-cols-5 gap-2 px-5 py-3 border-t border-[var(--border)]" style={{ background: "var(--bg-surface)" }}>
        <StatCard
          label="Available"
          value={`$${availableBalance.toFixed(2)}`}
        />
        <StatCard
          label="Daily PnL"
          value={`${isProfitable ? "+" : ""}${dailyPnl.toFixed(2)}`}
          color={isProfitable ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}
        />
        <StatCard
          label="Total PnL"
          value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}`}
          color={totalPnl >= 0 ? "text-[var(--color-profit)]" : "text-[var(--color-loss)]"}
        />
        <StatCard
          label="Win Rate"
          value={winRate === "—" ? "—" : `${winRate}%`}
          sub={totalClosed > 0 ? `${winCount}/${totalClosed} trades` : undefined}
        />
        <StatCard
          label="Open Positions"
          value={`${positions.length}`}
          sub={positions.length > 0 ? `${positions.filter(p => (p.unrealizedPnl ?? 0) >= 0).length} profitable` : undefined}
        />
      </div>
    </div>
  );
}
