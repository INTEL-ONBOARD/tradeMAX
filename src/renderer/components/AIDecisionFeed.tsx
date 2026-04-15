import { GlassCard } from "./GlassCard";

export function AIDecisionFeed({ decision }: { decision: any }) {
    return (
        <GlassCard title="AI Decision Feed" subtitle="Latest Claude recommendation">
            {decision ? (
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted">Decision</span>
                        <span className="font-semibold">{decision.decision}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted">Confidence</span>
                        <span>{(Number(decision.confidence || 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <p>Entry: {Number(decision.entry || 0).toFixed(2)}</p>
                        <p>SL: {Number(decision.stop_loss || 0).toFixed(2)}</p>
                        <p>TP: {Number(decision.take_profit || 0).toFixed(2)}</p>
                    </div>
                    <p className="text-muted">{decision.reason}</p>
                </div>
            ) : (
                <p className="text-sm text-muted">No AI output yet.</p>
            )}
        </GlassCard>
    );
}
