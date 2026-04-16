import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "./Card";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { LogEntry } from "../../shared/types";
import { Terminal, AlertCircle, Info, AlertTriangle } from "./icons";

const LevelIcon = ({ level }: { level: string }) => {
  const cls = "w-3.5 h-3.5 shrink-0";
  if (level === "ERROR") return <AlertCircle className={`${cls} text-[var(--color-loss)]`} />;
  if (level === "WARN")  return <AlertTriangle className={`${cls} text-[var(--color-warn)]`} />;
  return <Info className={`${cls} text-[var(--color-info)]`} />;
};

const categoryStyle: Record<string, string> = {
  AUTH:   "bg-[var(--color-info-bg)] text-[var(--color-info)]    border-[var(--color-info-border)]",
  TRADE:  "bg-[var(--color-profit-bg)] text-[var(--color-profit)] border-[var(--color-profit-border)]",
  AI:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  RISK:   "bg-[var(--color-warn-bg)] text-[var(--color-warn)] border-[var(--color-warn-border)]",
  SAFETY: "bg-[var(--color-loss-bg)] text-[var(--color-loss)] border-[var(--color-loss-border)]",
  SYSTEM: "bg-[var(--bg-inset)] text-[var(--text-secondary)] border-[var(--border)]",
};

export function LiveLogPanel() {
  const logs = useAppStore((s) => s.logs);
  const setLogs = useAppStore((s) => s.setLogs);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.api.invoke(IPC.LOGS_RECENT, { limit: 100 }).then((data) => {
      setLogs(data as LogEntry[]);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <Card className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Terminal size={14} className="text-[var(--text-tertiary)]" />
        <span className="section-label">Live Logs</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="status-dot-live" />
          <span className="text-[10px] text-[var(--text-tertiary)]">{logs.length} entries</span>
        </div>
      </div>

      {/* Log Container */}
      <div
        className="rounded-lg border border-[var(--border)] max-h-[260px] overflow-y-auto log-terminal"
        style={{ background: "var(--bg-base)" }}
      >
        {logs.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-[var(--text-tertiary)] opacity-60">No log entries yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-px">
            <AnimatePresence initial={false}>
              {[...logs].reverse().map((log, i) => (
                <motion.div
                  key={log._id ?? i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-[var(--bg-surface)] transition-colors group"
                >
                  {/* Level Icon */}
                  <div className="mt-0.5">
                    <LevelIcon level={log.level} />
                  </div>

                  {/* Category badge */}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase shrink-0 mt-0.5 min-w-[46px] justify-center ${
                    categoryStyle[log.category] ?? categoryStyle.SYSTEM
                  }`}>
                    {log.category}
                  </span>

                  {/* Message */}
                  <span className="text-[var(--text-secondary)] text-[11px] flex-1 leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">
                    {log.message}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </Card>
  );
}
