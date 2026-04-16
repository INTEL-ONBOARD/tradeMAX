// src/renderer/components/ConnectivityOverlay.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useConnectivity } from "../hooks/useConnectivity";

const STARTUP_MESSAGES = [
  "Connecting to servers...",
  "Authenticating...",
  "Loading portfolio...",
  "Syncing market data...",
];

const SYNC_STEPS = ["Reconnected", "Syncing data...", "Ready!"];

function WifiOffIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* ── Startup Boot State ─────────────────────────────────────── */

function StartupView() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % STARTUP_MESSAGES.length);
      setProgress((prev) => Math.min(prev + 20, 90));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Logo */}
      <div className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
        trade<span className="text-[var(--color-loss)]">MAX</span>
      </div>

      {/* Cycling message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="text-sm font-medium text-[var(--text-secondary)]"
        >
          {STARTUP_MESSAGES[msgIdx]}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="w-52 h-[3px] rounded-full bg-[var(--border)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "var(--color-loss)",
            boxShadow: "0 0 12px rgba(244,63,94,0.5)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Sub-label */}
      <p className="text-[10px] font-mono font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
        Initializing Services
      </p>
    </div>
  );
}

/* ── Connection Lost State ──────────────────────────────────── */

function DisconnectedView({ retryCount }: { retryCount: number }) {
  const exhausted = retryCount >= 10;
  const displayCount = Math.min(retryCount, 10);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full border-2 border-[var(--color-loss-border)] flex items-center justify-center text-[var(--color-loss)]">
        <WifiOffIcon />
      </div>

      {/* Title */}
      <p className="text-lg font-bold text-[var(--color-loss)]">Connection Lost</p>
      <p className="text-sm text-[var(--text-secondary)]">
        {exhausted ? "Please check your internet connection" : "Attempting to reconnect..."}
      </p>

      {/* Indeterminate progress bar */}
      <div className="w-52 h-[3px] rounded-full bg-[var(--border)] overflow-hidden relative">
        <div
          className="absolute inset-0 w-1/2 rounded-full progress-sweep"
          style={{
            background: "linear-gradient(90deg, transparent, var(--color-loss), transparent)",
          }}
        />
      </div>

      {/* Retry counter */}
      {!exhausted && (
        <p className="text-[10px] font-mono font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
          Retry {displayCount} of 10
        </p>
      )}
    </div>
  );
}

/* ── Syncing / Reconnection Sequence ────────────────────────── */

function SyncingView() {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setVisibleSteps(step);
      if (step >= SYNC_STEPS.length) clearInterval(interval);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full border-2 border-[var(--color-profit-border)] flex items-center justify-center text-[var(--color-profit)]">
        <CheckIcon />
      </div>

      {/* Title */}
      <p className="text-lg font-bold text-[var(--color-profit)]">
        {visibleSteps >= SYNC_STEPS.length ? "Ready!" : "Syncing Data..."}
      </p>

      {/* Progress bar */}
      <div className="w-52 h-[3px] rounded-full bg-[var(--border)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "var(--color-profit)",
            boxShadow: "0 0 12px rgba(16,185,129,0.5)",
          }}
          animate={{ width: `${((visibleSteps + 1) / SYNC_STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Step checklist */}
      <div className="flex flex-col gap-1.5 items-start">
        {SYNC_STEPS.map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={i < visibleSteps ? { opacity: 1, x: 0 } : { opacity: 0.3, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2"
          >
            <span
              className="text-[10px] font-mono"
              style={{ color: i < visibleSteps ? "var(--color-profit)" : "var(--text-tertiary)" }}
            >
              {i < visibleSteps ? "\u2713" : "\u25CB"}
            </span>
            <span
              className="text-[11px] font-mono"
              style={{ color: i < visibleSteps ? "var(--color-profit)" : "var(--text-tertiary)" }}
            >
              {label}
            </span>
          </motion.div>
        ))}
      </div>
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
          {state === "checking" && <StartupView />}
          {state === "offline" && <DisconnectedView retryCount={retryCount} />}
          {state === "reconnecting" && <DisconnectedView retryCount={retryCount} />}
          {state === "syncing" && <SyncingView />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
