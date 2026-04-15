import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { AgentControlPanel } from "../components/AgentControlPanel";
import { AIDecisionFeed } from "../components/AIDecisionFeed";
import { APIKeysPanel } from "../components/APIKeysPanel";
import { LiveLogPanel } from "../components/LiveLogPanel";
import { PortfolioPanel } from "../components/PortfolioPanel";
import { PositionsPanel } from "../components/PositionsPanel";
import { TradesPanel } from "../components/TradesPanel";
import { useAppStore } from "../store/appStore";

export function DashboardPage() {
    const { session, setTheme, theme } = useAppStore();
    const [portfolio, setPortfolio] = useState<any>(null);
    const [positions, setPositions] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [decision, setDecision] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [latestPrice, setLatestPrice] = useState<number>(0);
    const [isAgentOn, setIsAgentOn] = useState<boolean>(Boolean(session?.agentModeEnabled));
    const [mode, setMode] = useState<"spot" | "futures">((session?.tradingMode as "spot" | "futures") || "spot");
    const [symbol, setSymbol] = useState("BTCUSDT");

    const pnlColor = useMemo(() => ((portfolio?.dailyPnl || 0) >= 0 ? "text-green-400" : "text-red-400"), [portfolio?.dailyPnl]);

    async function refresh() {
        const [p, pos, t, d] = await Promise.all([
            window.trademax.trading.getPortfolio(),
            window.trademax.trading.getPositions(),
            window.trademax.trading.getTrades(),
            window.trademax.trading.getLastDecision()
        ]);
        setPortfolio(p);
        setPositions(pos || []);
        setTrades(t || []);
        setDecision(d);
    }

    useEffect(() => {
        refresh();
        const timer = setInterval(refresh, 12000);

        const unMarket = window.trademax.stream.onMarket((payload: any) => {
            if (payload?.price) {
                setLatestPrice(Number(payload.price));
            }
        });
        const unAi = window.trademax.stream.onAI((payload: any) => {
            if (payload?.decision) {
                setDecision(payload.decision);
            }
        });
        const unLogs = window.trademax.stream.onLogs((payload: any) => {
            setLogs((prev) => [payload, ...prev].slice(0, 50));
        });

        return () => {
            clearInterval(timer);
            unMarket();
            unAi();
            unLogs();
        };
    }, []);

    async function handleToggleAgent(next: boolean, nextSymbol: string) {
        setSymbol(nextSymbol || "BTCUSDT");
        if (next) {
            await window.trademax.trading.startAgent({ symbol: nextSymbol || "BTCUSDT" });
            setIsAgentOn(true);
        } else {
            await window.trademax.trading.stopAgent();
            setIsAgentOn(false);
        }
        await window.trademax.settings.update({ agentModeEnabled: next });
    }

    async function handleKillSwitch() {
        await window.trademax.trading.killSwitch({ symbols: [symbol] });
        setIsAgentOn(false);
    }

    async function handleModeChange(nextMode: "spot" | "futures") {
        setMode(nextMode);
        await window.trademax.settings.update({ tradingMode: nextMode });
    }

    return (
        <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6"
        >
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-3xl md:text-4xl">TradeMAX Command Center</h1>
                    <p className="text-xs text-muted md:text-sm">Agent: {isAgentOn ? "ON" : "OFF"} • Mode: {mode.toUpperCase()} • Last Price: {latestPrice ? `$${latestPrice.toFixed(2)}` : "-"}</p>
                </div>
                <div className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    Daily PnL: <span className={pnlColor}>${Number(portfolio?.dailyPnl || 0).toFixed(2)}</span>
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-4">
                    <PortfolioPanel portfolio={portfolio} />
                </div>
                <div className="xl:col-span-4">
                    <AIDecisionFeed decision={decision} />
                </div>
                <div className="xl:col-span-4">
                    <AgentControlPanel
                        isAgentOn={isAgentOn}
                        tradingMode={mode}
                        symbol={symbol}
                        onToggleAgent={handleToggleAgent}
                        onKillSwitch={handleKillSwitch}
                        onModeChange={handleModeChange}
                        onThemeToggle={() => {
                            const nextTheme = theme === "dark" ? "light" : "dark";
                            setTheme(nextTheme);
                            window.trademax.settings.update({ themePreference: nextTheme });
                        }}
                    />
                </div>

                <div className="xl:col-span-7">
                    <PositionsPanel positions={positions} />
                </div>
                <div className="xl:col-span-5">
                    <TradesPanel trades={trades} />
                </div>

                <div className="xl:col-span-12">
                    <APIKeysPanel />
                </div>

                <div className="xl:col-span-12">
                    <LiveLogPanel entries={logs} />
                </div>
            </section>
        </motion.main>
    );
}
