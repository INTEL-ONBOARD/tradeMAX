import { useState } from "react";
import { GlassCard } from "./GlassCard";

export function AgentControlPanel(props: {
    isAgentOn: boolean;
    tradingMode: "spot" | "futures";
    symbol: string;
    onToggleAgent: (next: boolean, symbol: string) => Promise<void>;
    onKillSwitch: () => Promise<void>;
    onModeChange: (mode: "spot" | "futures") => Promise<void>;
    onThemeToggle: () => void;
}) {
    const [symbol, setSymbol] = useState(props.symbol);

    return (
        <GlassCard title="Agent Controls" subtitle="Execution requires strict risk validation">
            <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                    <div>
                        <p className="text-sm font-medium">Agent Mode</p>
                        <p className="text-xs text-muted">{props.isAgentOn ? "ON: AI can request execution" : "OFF: analysis only"}</p>
                    </div>
                    <button className={`toggle ${props.isAgentOn ? "toggle-on" : ""}`} onClick={() => props.onToggleAgent(!props.isAgentOn, symbol)}>
                        <span />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-xs">
                        Symbol
                        <input className="input" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
                    </label>
                    <label className="flex flex-col gap-2 text-xs">
                        Trading Mode
                        <select className="input" value={props.tradingMode} onChange={(e) => props.onModeChange(e.target.value as "spot" | "futures")}>
                            <option value="spot">SPOT</option>
                            <option value="futures">FUTURES</option>
                        </select>
                    </label>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button className="btn-danger" onClick={() => props.onKillSwitch()}>
                        EMERGENCY KILL SWITCH
                    </button>
                    <button className="btn-secondary" onClick={props.onThemeToggle}>
                        Toggle Theme
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
