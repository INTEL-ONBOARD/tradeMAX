import { FormEvent, useState } from "react";
import { GlassCard } from "./GlassCard";

export function APIKeysPanel() {
    const [binanceKey, setBinanceKey] = useState("");
    const [binanceSecret, setBinanceSecret] = useState("");
    const [bybitKey, setBybitKey] = useState("");
    const [bybitSecret, setBybitSecret] = useState("");
    const [status, setStatus] = useState("");

    async function onSave(e: FormEvent) {
        e.preventDefault();
        setStatus("Saving...");
        await window.trademax.settings.updateApiKeys({
            binanceKey,
            binanceSecret,
            bybitKey,
            bybitSecret
        });
        setStatus("Encrypted keys saved");
    }

    return (
        <GlassCard title="API Credentials" subtitle="Encrypted at rest in MongoDB">
            <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={onSave}>
                <input className="input" placeholder="Binance API Key" value={binanceKey} onChange={(e) => setBinanceKey(e.target.value)} />
                <input className="input" placeholder="Binance API Secret" value={binanceSecret} onChange={(e) => setBinanceSecret(e.target.value)} />
                <input className="input" placeholder="Bybit API Key" value={bybitKey} onChange={(e) => setBybitKey(e.target.value)} />
                <input className="input" placeholder="Bybit API Secret" value={bybitSecret} onChange={(e) => setBybitSecret(e.target.value)} />
                <div className="md:col-span-2 flex items-center justify-between">
                    <p className="text-xs text-muted">{status || "Renderer never receives persisted secret values."}</p>
                    <button className="btn-primary" type="submit">Save API Keys</button>
                </div>
            </form>
        </GlassCard>
    );
}
