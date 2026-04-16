import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarRibbon } from "../components/Sidebar";
import { AgentControlPanel } from "../components/AgentControlPanel";
import { PositionsPanel } from "../components/PositionsPanel";
import { TradesPanel } from "../components/TradesPanel";
import { AIDecisionFeed } from "../components/AIDecisionFeed";
import { PortfolioPanel } from "../components/PortfolioPanel";
import { LiveLogPanel } from "../components/LiveLogPanel";
import { Activity, LayoutGrid, Terminal, Wallet } from "../components/icons";

// Component representing the "Tools & Features" large grid cards (Screenshot 3)
function ToolCard({ title, icon: Icon, tag }: { title: string, icon: React.ElementType, tag?: string }) {
  return (
    <div className="relative bg-[var(--bg-elevated)] border border-[var(--border)] rounded-sm p-6 flex flex-col items-center justify-center gap-4 hover:bg-[var(--bg-overlay)] transition-colors cursor-pointer group h-36">
      {tag && (
        <div className={`absolute top-0 right-0 px-6 py-1 text-[10px] font-bold text-white transform rotate-45 translate-x-[26px] translate-y-[6px] shadow ${tag === "PRO" ? "bg-[var(--color-loss)]" : "bg-[var(--color-profit)]"}`}>
          {tag}
        </div>
      )}
      <div className="w-12 h-12 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center group-hover:border-[var(--text-primary)] transition-colors">
        <Icon size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors text-center">
        {title}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const [activeView, setActiveView] = useState("agent");

  return (
    <div className="h-full w-full flex" style={{ background: "var(--bg-base)" }}>
      {/* Sidebar fills the entire left height */}
      <div className="h-full shrink-0 z-20">
        <SidebarRibbon activeView={activeView} onChangeView={setActiveView} />
      </div>

      {/* Content wrapper taking remaining space */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Invisible drag region for window dragging */}
        <div className="absolute top-0 left-0 right-0 h-8 z-30" style={{ WebkitAppRegion: "drag", pointerEvents: "none" } as React.CSSProperties} />

        <AnimatePresence mode="wait">
          {activeView === "agent" && (
            <motion.div
              key="agent"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 flex overflow-hidden"
            >
              {/* Left column — Agent dial card, vertically centered */}
              <div className="w-[340px] shrink-0 flex items-center justify-center border-r border-[var(--border)]">
                <AgentControlPanel />
              </div>

              {/* Right column — Positions & other panels, scrolls internally */}
              <div className="flex-1 overflow-y-auto p-6">
                <PositionsPanel />
              </div>
            </motion.div>
          )}

          {activeView === "tools" && (
            <motion.div
              key="tools"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden p-6 gap-4"
            >
              {/* Top row — 4 tool tiles (fixed height) */}
              <div>
                <h2 className="text-sm font-bold text-[var(--color-loss)] mb-3 pl-1 border-l-2 border-[var(--color-loss)] uppercase tracking-wider">
                  Analytics & Intelligence
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-hidden relative">
                  <ToolCard title="Portfolio Metrics" icon={Wallet} />
                  <ToolCard title="AI Signal Engine" icon={Activity} />
                  <ToolCard title="Deep Market Scan" icon={LayoutGrid} tag="PRO" />
                  <ToolCard title="Terminal Viewer" icon={Terminal} />
                </div>
              </div>

              {/* Bottom area — fills remaining height */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <h2 className="text-sm font-bold text-[var(--color-loss)] mb-3 pl-1 border-l-2 border-[var(--color-loss)] uppercase tracking-wider shrink-0">
                  Detailed Panels
                </h2>
                <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0">
                  <div className="overflow-hidden"><PortfolioPanel /></div>
                  <div className="overflow-hidden"><AIDecisionFeed /></div>
                  <div className="overflow-auto"><TradesPanel /></div>
                  <div className="overflow-auto"><LiveLogPanel /></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
