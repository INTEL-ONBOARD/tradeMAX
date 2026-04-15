import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";

export function AIDecisionFeed() {
  const decision = useAppStore((s) => s.lastAIDecision);

  return (
    <GlassCard className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">AI Decision</h3>

      {!decision ? (
        <p className="text-xs text-[var(--text-secondary)]">No decisions yet</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-bold ${
                decision.decision === "BUY"
                  ? "text-green-400"
                  : decision.decision === "SELL"
                  ? "text-red-400"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {decision.decision}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {(decision.confidence * 100).toFixed(0)}% conf
            </span>
          </div>

          {decision.decision !== "HOLD" && (
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div>
                <span className="text-[var(--text-secondary)]">Entry</span>
                <p className="font-mono">{decision.entry.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">SL</span>
                <p className="font-mono text-red-400">{decision.stop_loss.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">TP</span>
                <p className="font-mono text-green-400">{decision.take_profit.toLocaleString()}</p>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{decision.reason}</p>
        </>
      )}
    </GlassCard>
  );
}
