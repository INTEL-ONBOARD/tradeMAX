import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { Bot, TrendingUp, TrendingDown, Minus } from "./icons";

export function AIDecisionFeed() {
  const decision = useAppStore((s) => s.lastAIDecision);

  const decisionConfig = {
    BUY:  { color: "var(--color-profit)",  bg: "var(--color-profit-bg)",  border: "var(--color-profit-border)",  icon: TrendingUp,  badge: "badge-profit" },
    SELL: { color: "var(--color-loss)",    bg: "var(--color-loss-bg)",    border: "var(--color-loss-border)",    icon: TrendingDown, badge: "badge-loss"   },
    HOLD: { color: "var(--text-secondary)", bg: "var(--bg-inset)",         border: "var(--border)",               icon: Minus,        badge: "badge-neutral" },
  };

  const cfg = decision ? decisionConfig[decision.decision] : null;
  const DecisionIcon = cfg?.icon;

  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-3">
        <Bot size={12} className="text-[var(--text-tertiary)]" />
        <span className="section-label">AI Signal</span>
      </div>

      <AnimatePresence mode="wait">
        {!decision ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-[var(--text-tertiary)] text-center py-4"
          >
            Awaiting first signal...
          </motion.p>
        ) : (
          <motion.div
            key={decision.decision + decision.confidence}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Decision Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {DecisionIcon && <DecisionIcon size={16} style={{ color: cfg?.color }} />}
                <span className={cfg?.badge ?? "badge-neutral"} style={{ fontSize: "0.875rem" }}>
                  {decision.decision}
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {(decision.confidence * 100).toFixed(0)}% conf
              </span>
            </div>

            {/* Confidence Bar */}
            <div className="confidence-bar-track">
              <motion.div
                className="confidence-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${decision.confidence * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>

            {/* Price Levels */}
            {decision.decision !== "HOLD" && (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "Entry", value: decision.entry, color: "text-[var(--text-primary)]" },
                  { label: "Stop",  value: decision.stop_loss, color: "text-[var(--color-loss)]" },
                  { label: "TP",    value: decision.take_profit, color: "text-[var(--color-profit)]" },
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

            {/* Reason */}
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)] pt-2">
              {decision.reason}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
