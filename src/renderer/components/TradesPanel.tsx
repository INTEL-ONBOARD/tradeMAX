import { GlassCard } from "./GlassCard";

export function TradesPanel({ trades }: { trades: any[] }) {
    return (
        <GlassCard title="Recent Trades" subtitle="Execution and rejection history">
            <div className="space-y-2">
                {trades.slice(0, 8).map((t: any) => (
                    <div key={t._id} className="rounded-xl border border-white/10 p-3 text-xs md:text-sm">
                        <div className="flex items-center justify-between">
                            <p className="font-medium">{t.symbol} {t.side}</p>
                            <p className={Number(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}>${Number(t.pnl || 0).toFixed(2)}</p>
                        </div>
                        <p className="text-muted">{t.source} • {t.status} • {new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
