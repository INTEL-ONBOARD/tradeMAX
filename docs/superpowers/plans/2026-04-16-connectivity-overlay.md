# Connectivity Overlay System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen blocking overlay that appears on app startup and when internet drops mid-session, with an animated reconnection sequence before dismissing.

**Architecture:** Hybrid detection — browser `offline`/`online` events for instant signals, plus a confirmation fetch to `https://dns.google/resolve?name=google.com` to verify real connectivity. All logic lives in the renderer: a `useConnectivity` hook manages the state machine, and a `ConnectivityOverlay` component renders the 3 visual states. No IPC or main process changes.

**Tech Stack:** React, Framer Motion (already installed), Tailwind CSS, existing CSS variables

**Spec:** `docs/superpowers/specs/2026-04-16-connectivity-overlay-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/renderer/hooks/useConnectivity.ts` | Create | State machine hook: online/offline detection, confirmation fetch, polling, retry counter |
| `src/renderer/components/ConnectivityOverlay.tsx` | Create | Full-screen overlay component with 3 visual states (startup, disconnected, syncing) |
| `src/renderer/styles/index.css` | Modify | Add `@keyframes` for indeterminate progress bar sweep |
| `src/renderer/App.tsx` | Modify | Render `<ConnectivityOverlay />` at root level |

---

### Task 1: Create `useConnectivity` Hook

**Files:**
- Create: `src/renderer/hooks/useConnectivity.ts`

- [ ] **Step 1: Create the hooks directory and hook file**

```typescript
// src/renderer/hooks/useConnectivity.ts
import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectivityState =
  | "checking"      // startup, not yet confirmed
  | "online"        // confirmed online
  | "offline"       // lost connection
  | "reconnecting"  // online event fired, running confirmation fetch
  | "syncing";      // confirmed back, running animated sequence

const CONFIRM_URL = "https://dns.google/resolve?name=google.com";
const POLL_INTERVAL_MS = 5000;
const POLL_INTERVAL_EXHAUSTED_MS = 10000;
const MAX_RETRIES = 10;

async function confirmOnline(): Promise<boolean> {
  try {
    const res = await fetch(CONFIRM_URL, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
    });
    return true;
  } catch {
    return false;
  }
}

export function useConnectivity() {
  const [state, setState] = useState<ConnectivityState>("checking");
  const [retryCount, setRetryCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    let count = 0;
    setRetryCount(0);

    pollRef.current = setInterval(async () => {
      count++;
      setRetryCount(count);
      const isOnline = await confirmOnline();
      if (isOnline) {
        stopPolling();
        setState("reconnecting");
      }
      // After MAX_RETRIES, slow down polling
      if (count >= MAX_RETRIES && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          count++;
          setRetryCount(count);
          const ok = await confirmOnline();
          if (ok) {
            stopPolling();
            setState("reconnecting");
          }
        }, POLL_INTERVAL_EXHAUSTED_MS);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  // Handle "reconnecting" → confirm → "syncing" or back to "offline"
  useEffect(() => {
    if (state !== "reconnecting") return;

    let cancelled = false;
    (async () => {
      const ok = await confirmOnline();
      if (cancelled) return;
      if (ok) {
        setState("syncing");
      } else {
        setState("offline");
        startPolling();
      }
    })();

    return () => { cancelled = true; };
  }, [state, startPolling]);

  // Handle "syncing" → wait 2.5s → "online"
  useEffect(() => {
    if (state !== "syncing") return;

    syncTimeoutRef.current = setTimeout(() => {
      setState("online");
    }, 2500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [state]);

  // Startup check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.onLine) {
        setState("offline");
        startPolling();
        return;
      }
      const ok = await confirmOnline();
      if (cancelled) return;
      if (ok) {
        setState("syncing");
      } else {
        setState("offline");
        startPolling();
      }
    })();

    return () => { cancelled = true; };
  }, [startPolling]);

  // Browser online/offline events
  useEffect(() => {
    const handleOffline = () => {
      stopPolling();
      setState("offline");
      startPolling();
    };

    const handleOnline = () => {
      stopPolling();
      setState("reconnecting");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  const showOverlay = state !== "online";

  return { state, retryCount, showOverlay };
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/renderer/hooks/useConnectivity.ts 2>&1 || echo "Check for errors"`

Expect: no type errors (or only unrelated project-level errors — confirm the hook file itself has no issues).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useConnectivity.ts
git commit -m "feat: add useConnectivity hook with hybrid online/offline detection"
```

---

### Task 2: Add CSS Keyframes for Indeterminate Progress Bar

**Files:**
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Add the keyframes and overlay utility classes at the end of `index.css`**

Append after the existing `/* ─── Confidence Bar */` section (end of file):

```css
/* ─── Connectivity Overlay ─────────────────────────────────── */

@keyframes sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
.progress-sweep {
  animation: sweep 1.5s ease-in-out infinite;
}

@keyframes fade-pulse {
  0%, 100% { opacity: 0.4; }
  50%      { opacity: 1; }
}
.connectivity-fade-pulse {
  animation: fade-pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/styles/index.css
git commit -m "feat: add CSS keyframes for connectivity overlay animations"
```

---

### Task 3: Create `ConnectivityOverlay` Component

**Files:**
- Create: `src/renderer/components/ConnectivityOverlay.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// src/renderer/components/ConnectivityOverlay.tsx
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useConnectivity, ConnectivityState } from "../hooks/useConnectivity";

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
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "ConnectivityOverlay\|useConnectivity" || echo "No errors in overlay files"`

Expect: no type errors referencing these files.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ConnectivityOverlay.tsx
git commit -m "feat: add ConnectivityOverlay component with startup, disconnected, and syncing states"
```

---

### Task 4: Wire Overlay into `App.tsx`

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add import for `ConnectivityOverlay`**

At the top of `App.tsx`, after the existing component imports (around line 7), add:

```typescript
import { ConnectivityOverlay } from "./components/ConnectivityOverlay";
```

- [ ] **Step 2: Render the overlay at root level**

Inside the return statement, add `<ConnectivityOverlay />` as the first child of the outermost `<div>`, before the drag region. The return block should look like:

```tsx
  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <ConnectivityOverlay />

      {/* Invisible drag region for Intro/Auth pages */}
      {currentScreen !== "dashboard" && <div className="absolute top-0 left-0 right-0 h-8 z-50" style={{ WebkitAppRegion: "drag", pointerEvents: "none" } as React.CSSProperties} />}
      
      <div className="h-full w-full relative">
        <AnimatePresence mode="wait">
          {currentScreen === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
              <IntroPage />
            </motion.div>
          )}
          {currentScreen === "auth" && (
            <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="absolute inset-0">
              <AuthPage />
            </motion.div>
          )}
          {currentScreen === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0">
              <DashboardPage />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: wire ConnectivityOverlay into App root"
```

---

### Task 5: Manual Testing

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Wait for the Electron window to open.

- [ ] **Step 2: Test startup overlay**

Expected: When the app opens, you briefly see the startup overlay with "tradeMAX" logo, cycling messages ("Connecting to servers...", "Authenticating..."), and a red progress bar. After ~2-3 seconds (once the confirmation fetch passes), the syncing sequence plays ("Reconnected → Syncing → Ready!") and the overlay fades away.

- [ ] **Step 3: Test disconnect overlay**

1. Turn off WiFi on your Mac (System Settings > Wi-Fi > toggle off)
2. Expected: Within 1-2 seconds the full-screen "Connection Lost" overlay appears with the WiFi-off icon, red indeterminate progress bar, and "Attempting to reconnect..." message
3. The retry counter should increment: "RETRY 1 OF 10", "RETRY 2 OF 10", etc.

- [ ] **Step 4: Test reconnection sequence**

1. Turn WiFi back on
2. Expected: On the next successful poll, the overlay transitions to the green syncing sequence: checkmark icon, "Reconnected" → "Syncing data..." → "Ready!" steps appear one by one
3. After ~2.5 seconds, overlay fades out and the app is usable again

- [ ] **Step 5: Test overlay blocks interaction**

While the overlay is visible (during disconnect), try clicking on the app underneath. Expected: Nothing happens — the overlay blocks all pointer events.

- [ ] **Step 6: Commit any fixes**

If any visual tweaks or bug fixes are needed, apply them and commit:

```bash
git add -A
git commit -m "fix: connectivity overlay visual adjustments from manual testing"
```

---
