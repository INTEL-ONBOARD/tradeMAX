import { useEffect } from "react";
import { GlassCard } from "./GlassCard";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { LogEntry } from "../../shared/types";

const levelColors: Record<string, string> = {
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
};

const categoryColors: Record<string, string> = {
  AUTH: "bg-blue-500/20 text-blue-400",
  TRADE: "bg-green-500/20 text-green-400",
  AI: "bg-purple-500/20 text-purple-400",
  RISK: "bg-orange-500/20 text-orange-400",
  SAFETY: "bg-red-500/20 text-red-400",
  SYSTEM: "bg-gray-500/20 text-gray-400",
};

export function LiveLogPanel() {
  const logs = useAppStore((s) => s.logs);
  const setLogs = useAppStore((s) => s.setLogs);

  useEffect(() => {
    window.api.invoke(IPC.LOGS_RECENT, { limit: 100 }).then((data) => {
      setLogs(data as LogEntry[]);
    });
  }, []);

  return (
    <GlassCard className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Live Logs</h3>

      <div className="max-h-[300px] overflow-y-auto space-y-1">
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No logs yet</p>
        ) : (
          logs.map((log, i) => (
            <div key={log._id ?? i} className="flex items-start gap-2 text-xs py-1 border-b border-[var(--border)]/30">
              <span className={`font-mono min-w-[36px] ${levelColors[log.level] ?? ""}`}>
                {log.level}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] min-w-[48px] text-center ${categoryColors[log.category] ?? ""}`}>
                {log.category}
              </span>
              <span className="text-[var(--text-primary)] flex-1">{log.message}</span>
              <span className="text-[var(--text-secondary)] min-w-[60px] text-right">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}
