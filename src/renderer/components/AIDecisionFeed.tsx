import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Activity, Bot, Minus, TrendingDown, TrendingUp } from "./icons";
import type { SelfReviewResult } from "../../shared/types";

export function AIDecisionFeed() {
  const cycle = useAppStore((s) => s.lastAIDecision);
  const decision = cycle?.finalDecision;
  const [selfReviewResult, setSelfReviewResult] = useState<SelfReviewResult | null>(null);
  const [selfReviewLoading, setSelfReviewLoading] = useState(false);
  const [selfReviewMessage, setSelfReviewMessage] = useState<string | null>(null);

  const decisionConfig = {
    BUY: { color: "var(--color-profit)", icon: TrendingUp, badge: "badge-profit" },
    SELL: { color: "var(--color-loss)", icon: TrendingDown, badge: "badge-loss" },
    HOLD: { color: "var(--text-secondary)", icon: Minus, badge: "badge-neutral" },
  };

  const cfg = decision ? decisionConfig[decision.decision] : null;
  const DecisionIcon = cfg?.icon;

  const handleSelfReview = async () => {
    setSelfReviewLoading(true);
    setSelfReviewMessage(null);
    try {
      const result = await window.api.invoke(IPC.AI_SELF_REVIEW, { force: true }) as SelfReviewResult | null;
      if (result) {
        setSelfReviewResult(result);
        setSelfReviewMessage(`Reviewed ${result.reviewedTradeCount} trades and ${result.reviewedJournalCount} journals.`);
      } else {
        setSelfReviewMessage("No new review data available.");
      }
    } catch (error) {
      setSelfReviewMessage(error instanceof Error ? error.message : "Self review failed");
    } finally {
      setSelfReviewLoading(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Bot size={12} className="text-[var(--text-tertiary)]" />
          <span className="section-label">AI Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSelfReview()}
            disabled={selfReviewLoading}
            className="px-2 py-1 rounded-md border border-[var(--border)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors disabled:opacity-50"
          >
            {selfReviewLoading ? "Reviewing..." : "Run Self Review"}
          </button>
          {cycle && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
              <Activity size={10} />
              {cycle.latencyMs.total}ms
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!cycle || !decision ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-[var(--text-tertiary)] text-center py-4"
          >
            Awaiting first pipeline cycle...
          </motion.p>
        ) : (
          <motion.div key={cycle.cycleId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {DecisionIcon && <DecisionIcon size={16} style={{ color: cfg?.color }} />}
                <span className={cfg?.badge ?? "badge-neutral"} style={{ fontSize: "0.875rem" }}>
                  {decision.decision}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[var(--border)] text-[var(--text-secondary)]">
                  {cycle.profile}
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {(decision.confidence * 100).toFixed(0)}% conf
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-[var(--bg-inset)] rounded-md p-2">
                <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Regime</p>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{cycle.marketAssessment.regime}</p>
              </div>
              <div className="bg-[var(--bg-inset)] rounded-md p-2">
                <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Tempo</p>
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">
                  {cycle.marketAssessment.tempoFit} / {cycle.marketAssessment.volatilityBucket}
                </p>
              </div>
            </div>

            {decision.decision !== "HOLD" && (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Entry", value: decision.entry, color: "text-[var(--text-primary)]" },
                  { label: "Stop", value: decision.stop_loss, color: "text-[var(--color-loss)]" },
                  { label: "Target", value: decision.take_profit, color: "text-[var(--color-profit)]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[var(--bg-inset)] rounded-md p-2">
                    <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">{label}</p>
                    <p className={`text-[11px] font-mono font-semibold ${color}`}>
                      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[var(--bg-inset)] rounded-md p-2.5 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Pipeline Stages</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Analyst: {cycle.marketAssessment.summary}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Architect: {cycle.tradeProposal.thesis}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Critic: {cycle.executionReview.reasons.join("; ") || "Approved"}
              </p>
            </div>

            {cycle.retrievedMemories.length > 0 && (
              <div className="border-t border-[var(--border)] pt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Retrieved Memory</p>
                {cycle.retrievedMemories.slice(0, 2).map((item) => (
                  <p key={item.id} className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {item.summary}
                  </p>
                ))}
              </div>
            )}

            {(selfReviewResult || selfReviewMessage) && (
              <div className="border-t border-[var(--border)] pt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Self Review</p>
                {selfReviewMessage && (
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {selfReviewMessage}
                  </p>
                )}
                {selfReviewResult && (
                  <>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {selfReviewResult.summary}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                      Memory: {selfReviewResult.memoryNote}
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
