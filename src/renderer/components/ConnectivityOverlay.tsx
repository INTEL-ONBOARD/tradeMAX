// src/renderer/components/ConnectivityOverlay.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useConnectivity, type ConnectivityState } from "../hooks/useConnectivity";

const STARTUP_MESSAGES = [
  "Connecting to servers...",
  "Authenticating...",
  "Loading portfolio...",
  "Syncing market data...",
];


/* ── Unified Overlay View ──────────────────────────────────── */

function OverlayView({ state, retryCount }: { state: ConnectivityState; retryCount: number }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [startupProgress, setStartupProgress] = useState(5);

  const exhausted = retryCount >= 10;
  const displayCount = Math.min(retryCount, 10);

  // Cycle startup messages
  useEffect(() => {
    if (state !== "checking") return;
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % STARTUP_MESSAGES.length);
      setStartupProgress((prev) => Math.min(prev + 20, 90));
    }, 2000);
    return () => clearInterval(interval);
  }, [state]);

  // Derive visuals from state
  const isStartup = state === "checking";
  const isSyncing = state === "syncing";
  const isOffline = state === "offline" || state === "reconnecting";

  const statusText = isSyncing
    ? "Syncing data..."
    : isOffline
      ? exhausted
        ? "Check your internet connection"
        : `Retry ${displayCount} of 10`
      : STARTUP_MESSAGES[msgIdx];

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Logo — always visible */}
      <div className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
        trade<span className="text-[var(--color-loss)]">MAX</span>
      </div>

      {/* Progress bar */}
      <div className="w-52 h-[3px] rounded-full bg-[var(--border)] overflow-hidden relative">
        {isSyncing ? (
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "var(--color-profit)",
              boxShadow: "0 0 12px rgba(16,185,129,0.5)",
            }}
            initial={{ width: "60%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeOut" }}
          />
        ) : isStartup ? (
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "var(--color-loss)",
              boxShadow: "0 0 12px rgba(244,63,94,0.5)",
            }}
            animate={{ width: `${startupProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ) : (
          <div
            className="absolute inset-0 w-1/2 rounded-full progress-sweep"
            style={{
              background: "linear-gradient(90deg, transparent, var(--color-loss), transparent)",
            }}
          />
        )}
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={statusText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="text-[10px] font-mono font-medium tracking-widest text-[var(--text-tertiary)] uppercase"
        >
          {statusText}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/* ── Main Overlay ───────────────────────────────────────────── */

export function ConnectivityOverlay() {
  const { state, retryCount, showOverlay } = useConnectivity();

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key="connectivity-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center grid-bg"
          style={{ background: "var(--bg-base)" }}
        >
          <OverlayView state={state} retryCount={retryCount} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
