import { GlassCard } from "./GlassCard";

export function PortfolioPanel({ portfolio }: { portfolio: any }) {
    return (
        <GlassCard title="Portfolio" subtitle="Combined Binance + Bybit snapshot">
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-muted">Total Balance</p>
                    <p className="text-xl font-semibold">${(portfolio?.totalBalance || 0).toFixed(2)}</p>
                </div>
                <div>
                    <p className="text-muted">Daily PnL</p>
                    <p className={`text-xl font-semibold ${(portfolio?.dailyPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ${(portfolio?.dailyPnl || 0).toFixed(2)}
                    </p>
                </div>
                <div>
                    <p className="text-muted">Weekly PnL</p>
                    <p className={`text-xl font-semibold ${(portfolio?.weeklyPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ${(portfolio?.weeklyPnl || 0).toFixed(2)}
                    </p>
                </div>
                <div>
                    <p className="text-muted">Allocation</p>
                    <div className="space-y-1 text-xs">
                        {(portfolio?.allocation || []).map((a: any) => (
                            <p key={a.asset}>
                                {a.asset}: {(a.percent * 100).toFixed(1)}%
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
