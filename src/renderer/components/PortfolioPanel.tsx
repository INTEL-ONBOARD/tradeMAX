import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import { Wallet } from "./icons";

const generateInitialData = (currentBalance: number) => {
  const data: number[] = [];
  for (let i = 0; i < 40; i++) {
    data.push(currentBalance);
  }
  return data;
};

// Catmull-Rom spline for buttery smooth curves
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

export function PortfolioPanel() {
  const portfolio = useAppStore((s) => s.portfolio);
  const totalBalance = portfolio?.totalBalance ?? 0;

  const dailyPnl = portfolio?.dailyPnl ?? 0;
  const isProfitable = dailyPnl >= 0;

  const [chartData, setChartData] = useState<number[]>(generateInitialData(totalBalance));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Update chart with real portfolio balance changes
  useEffect(() => {
    setChartData((prev) => {
      const lastVal = prev[prev.length - 1];
      if (Math.abs(lastVal - totalBalance) > 0.01) {
        return [...prev.slice(-39), totalBalance];
      }
      return prev;
    });
  }, [totalBalance]);

  // Chart geometry
  const W = 400;
  const H = 120;
  const padT = 16;
  const padB = 8;

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
  const gradientId = isProfitable ? "areaGradProfit" : "areaGradLoss";
  const glowId = isProfitable ? "glowProfit" : "glowLoss";

  // Hover handling
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

  return (
    <div className="relative overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-7 h-7 rounded-lg bg-[var(--bg-overlay)] border border-[var(--border)] flex items-center justify-center">
          <Wallet size={13} className="text-[var(--text-secondary)]" />
        </div>
        <span className="text-[11px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
          Portfolio
        </span>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-overlay)]">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: chartColor }}
            />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: chartColor }} />
          </span>
          <span className="text-[9px] font-mono font-bold text-[var(--text-secondary)] tracking-wider">
            LIVE
          </span>
        </div>
      </div>

      {/* Balance */}
      <div className="px-1 mb-1">
        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5 uppercase tracking-wider font-medium">
          Total Balance
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={portfolio?.totalBalance}
            initial={{ opacity: 0.5, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            $
            {(portfolio?.totalBalance ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 mt-1 -mx-1">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Area gradient */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
              <stop offset="50%" stopColor={chartColor} stopOpacity={0.08} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
            {/* Line glow */}
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Subtle grid lines */}
          {[0.25, 0.5, 0.75].map((r) => (
            <line
              key={r}
              x1={0}
              y1={padT + r * (H - padT - padB)}
              x2={W}
              y2={padT + r * (H - padT - padB)}
              stroke="var(--border)"
              strokeWidth="0.5"
              strokeDasharray="4 6"
            />
          ))}

          {/* Filled area */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Main line with glow */}
          <path
            d={linePath}
            fill="none"
            stroke={chartColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${glowId})`}
          />

          {/* Hover crosshair */}
          {hoveredPt && (
            <>
              <line
                x1={hoveredPt.x}
                y1={padT}
                x2={hoveredPt.x}
                y2={H}
                stroke="var(--text-tertiary)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
              <circle cx={hoveredPt.x} cy={hoveredPt.y} r="4" fill={chartColor} stroke="var(--bg-base)" strokeWidth="2" />
            </>
          )}

          {/* Live pulse dot at end */}
          {!hoveredPt && (
            <>
              <circle cx={lastPt.x} cy={lastPt.y} r="6" fill={chartColor} opacity={0.2}>
                <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={lastPt.x} cy={lastPt.y} r="3" fill={chartColor} stroke="var(--bg-base)" strokeWidth="1.5" />
            </>
          )}
        </svg>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredPt && hoveredVal !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-14 right-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-mono font-semibold text-[var(--text-primary)]"
              style={{ background: "var(--bg-overlay)" }}
            >
              ${hoveredVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
