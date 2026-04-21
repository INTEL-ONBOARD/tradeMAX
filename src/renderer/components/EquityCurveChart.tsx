import { useState, useRef } from "react";
import { useAppStore } from "../store/appStore";
import { motion, AnimatePresence } from "framer-motion";
import type { ClosedPnlRecord } from "../../shared/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function catmullRomPath(points: { x: number; y: number }[], minY: number, maxY: number): string {
  if (points.length < 2) return "";
  const tension = 0.3;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = clamp(p1.y + (p2.y - p0.y) * tension, minY, maxY);
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = clamp(p2.y - (p3.y - p1.y) * tension, minY, maxY);
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

interface EquityCurveChartProps {
  filter?: string;
}

export function EquityCurveChart({ filter = "ALL" }: EquityCurveChartProps) {
  const exchangeHistory = useAppStore((s) => s.exchangeHistory);
  const portfolio = useAppStore((s) => s.portfolio);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  const filtered = exchangeHistory
    .filter((t) => new Date(t.closedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.closedAt).getTime() - new Date(b.closedAt).getTime());

  if (filtered.length === 0) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg">
        <p className="text-xs text-[var(--text-tertiary)]">
          {exchangeHistory.length === 0
            ? "No closed trades on exchange"
            : `No trades in ${filter} window (${exchangeHistory.length} total)`}
        </p>
      </div>
    );
  }

  const totalPnl = filtered.reduce((s, t) => s + t.pnl, 0);
  const currentBalance = portfolio?.totalBalance ?? 0;
  const startBalance = currentBalance - totalPnl || 10000;

  const equityPoints = [startBalance];
  let cumPnl = 0;
  for (const t of filtered) {
    cumPnl += t.pnl;
    equityPoints.push(startBalance + cumPnl);
  }

  const W = 600;
  const H = 200;
  const padT = 20;
  const padB = 10;

  const min = Math.min(...equityPoints) * 0.999;
  const max = Math.max(...equityPoints) * 1.001;
  const range = max - min || 1;

  const points = equityPoints.map((val, i) => ({
    x: (i / (equityPoints.length - 1)) * W,
    y: padT + (1 - (val - min) / range) * (H - padT - padB),
  }));

  const linePath = catmullRomPath(points, padT, H - padB);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`;
  const isProfitable = equityPoints[equityPoints.length - 1] >= startBalance;
  const chartColor = isProfitable ? "var(--color-profit)" : "var(--color-loss)";

  const startY = padT + (1 - (startBalance - min) / range) * (H - padT - padB);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round((x / W) * (equityPoints.length - 1));
    setHoveredIdx(Math.max(0, Math.min(idx, equityPoints.length - 1)));
  };

  const hoveredPt = hoveredIdx !== null ? points[hoveredIdx] : null;
  const hoveredVal = hoveredIdx !== null ? equityPoints[hoveredIdx] : null;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height="200"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="overflow-hidden cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
          <filter id="eqGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={0} y1={padT + r * (H - padT - padB)} x2={W} y2={padT + r * (H - padT - padB)} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 6" />
        ))}

        <line x1={0} y1={startY} x2={W} y2={startY} stroke="var(--text-tertiary)" strokeWidth="0.8" strokeDasharray="6 4" opacity={0.5} />

        <path d={areaPath} fill="url(#eqGrad)" />
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" filter="url(#eqGlow)" />

        {hoveredPt && (
          <>
            <line x1={hoveredPt.x} y1={padT} x2={hoveredPt.x} y2={H} stroke="var(--text-tertiary)" strokeWidth="0.5" strokeDasharray="3 3" />
            <circle cx={hoveredPt.x} cy={hoveredPt.y} r="4" fill={chartColor} stroke="var(--bg-base)" strokeWidth="2" />
          </>
        )}
      </svg>

      <AnimatePresence>
        {hoveredPt && hoveredVal !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-mono font-semibold text-[var(--text-primary)]"
            style={{ background: "var(--bg-overlay)" }}
          >
            ${hoveredVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-[9px] text-[var(--text-tertiary)] ml-1">Trade #{hoveredIdx}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
