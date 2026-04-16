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

function WifiOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}


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

      {/* Icon — only shown for offline/reconnecting */}
      {isOffline && (
        <div
          className="w-16 h-16 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: "var(--color-loss-border)", color: "var(--color-loss)" }}
        >
          <WifiOffIcon />
        </div>
      )}

      {/* Title — only shown for offline */}
      {isOffline && (
        <p className="text-lg font-bold" style={{ color: "var(--color-loss)" }}>
          Connection Lost
        </p>
      )}

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
