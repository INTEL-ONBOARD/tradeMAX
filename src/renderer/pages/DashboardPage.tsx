import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarRibbon } from "../components/Sidebar";
import { AgentControlPanel } from "../components/AgentControlPanel";
import { PositionsPanel } from "../components/PositionsPanel";
import { PerformanceMetrics } from "../components/PerformanceMetrics";
import { TradesPanel } from "../components/TradesPanel";
import { AIDecisionFeed } from "../components/AIDecisionFeed";
import { PortfolioPanel } from "../components/PortfolioPanel";
import { PortfolioModalContent } from "../components/PortfolioModalContent";
import { LiveLogPanel } from "../components/LiveLogPanel";
import { Modal } from "../components/Modal";
import { Activity, LayoutGrid, Terminal, Wallet } from "../components/icons";

type ToolPanel = "portfolio" | "ai-signal" | "market-scan" | "terminal" | null;

function ToolCard({ title, icon: Icon, tag, onClick }: { title: string; icon: React.ElementType; tag?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-[var(--bg-overlay)] hover:border-[var(--text-tertiary)] transition-all cursor-pointer group h-36 w-full"
    >
      {tag && (
        <div className={`absolute top-0 right-0 px-6 py-1 text-[10px] font-bold text-white transform rotate-45 translate-x-[26px] translate-y-[6px] ${tag === "PRO" ? "bg-[var(--color-loss)]" : "bg-[var(--color-profit)]"}`}>
          {tag}
        </div>
      )}
      <div className="w-12 h-12 rounded-full border-2 border-[var(--text-tertiary)] flex items-center justify-center group-hover:border-[var(--text-primary)] transition-colors">
        <Icon size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors text-center">
        {title}
      </span>
    </button>
  );
}

const panelConfig: Record<string, { title: string; width: string; height: string }> = {
  portfolio:     { title: "Portfolio Metrics", width: "820px", height: "580px" },
  "ai-signal":   { title: "AI Signal Engine",  width: "560px", height: "460px" },
  "market-scan": { title: "Recent Trades",     width: "860px", height: "520px" },
  terminal:      { title: "Live Logs",          width: "860px", height: "520px" },
};

export function DashboardPage() {
  const [activeView, setActiveView] = useState("agent");
  const [openPanel, setOpenPanel] = useState<ToolPanel>(null);

  const cfg = openPanel ? panelConfig[openPanel] : null;

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
                <div className="mt-4">
                  <PerformanceMetrics />
                </div>
              </div>
            </motion.div>
          )}

          {activeView === "tools" && (
            <motion.div
              key="tools"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col overflow-hidden p-6 gap-4"
            >
              {/* Tool tiles */}
              <div>
                <h2 className="text-sm font-bold text-[var(--color-loss)] mb-3 pl-1 border-l-2 border-[var(--color-loss)] uppercase tracking-wider">
                  Analytics & Intelligence
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ToolCard title="Portfolio Metrics" icon={Wallet} onClick={() => setOpenPanel("portfolio")} />
                  <ToolCard title="AI Signal Engine" icon={Activity} onClick={() => setOpenPanel("ai-signal")} />
                  <ToolCard title="Deep Market Scan" icon={LayoutGrid} onClick={() => setOpenPanel("market-scan")} />
                  <ToolCard title="Live Log" icon={Terminal} onClick={() => setOpenPanel("terminal")} />
                </div>
              </div>

              {/* Detailed Panels below */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">

                <div className="flex-1 flex gap-4 min-h-0">
                  {/* Left column — Recent Trades (full height) */}
                  <div className="flex-1 overflow-auto"><TradesPanel /></div>
                  {/* Right column — Portfolio on top, AI Signal below */}
                  <div className="w-[300px] shrink-0 flex flex-col gap-4 overflow-hidden">
                    <div className="overflow-hidden"><PortfolioPanel /></div>
                    <div className="flex-1 overflow-auto"><AIDecisionFeed /></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Panel modals */}
      {cfg && openPanel && (
        <Modal
          isOpen={!!openPanel}
          onClose={() => setOpenPanel(null)}
          title={cfg.title}
          width={cfg.width}
          height={cfg.height}
        >
          {openPanel === "portfolio" ? (
            <PortfolioModalContent />
          ) : (
            <div className="flex-1 overflow-y-auto p-5">
              {openPanel === "ai-signal" && <AIDecisionFeed />}
              {openPanel === "market-scan" && <TradesPanel />}
              {openPanel === "terminal" && <LiveLogPanel />}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
