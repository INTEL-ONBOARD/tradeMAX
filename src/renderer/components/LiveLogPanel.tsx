import { GlassCard } from "./GlassCard";

export function LiveLogPanel({ entries }: { entries: any[] }) {
    return (
        <GlassCard title="Live System Feed" subtitle="Risk checks, execution, and error stream">
            <div className="max-h-52 space-y-2 overflow-auto pr-1 text-xs">
                {entries.slice(0, 20).map((entry, idx) => (
                    <div key={idx} className="rounded-lg border border-white/10 px-2 py-1">
                        <p className="font-medium">[{entry.level || "INFO"}] {entry.category || "SYSTEM"}</p>
                        <p className="text-muted">{entry.message || "-"}</p>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
