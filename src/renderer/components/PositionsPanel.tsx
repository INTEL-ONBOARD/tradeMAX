import { GlassCard } from "./GlassCard";

export function PositionsPanel({ positions }: { positions: any[] }) {
    return (
        <GlassCard title="Live Positions" subtitle="Open futures and spot exposure">
            <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm">
                    <thead className="text-muted">
                        <tr>
                            <th className="text-left">Symbol</th>
                            <th className="text-left">Side</th>
                            <th className="text-left">Entry</th>
                            <th className="text-left">Mark</th>
                            <th className="text-left">uPnL</th>
                            <th className="text-left">Liq</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.map((p, i) => (
                            <tr key={`${p.symbol}-${i}`} className="border-t border-white/10">
                                <td>{p.symbol}</td>
                                <td>{p.side}</td>
                                <td>{Number(p.entryPrice || 0).toFixed(2)}</td>
                                <td>{Number(p.markPrice || 0).toFixed(2)}</td>
                                <td className={Number(p.unrealizedPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}>{Number(p.unrealizedPnl || 0).toFixed(2)}</td>
                                <td>{p.liquidationPrice ? Number(p.liquidationPrice).toFixed(2) : "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
