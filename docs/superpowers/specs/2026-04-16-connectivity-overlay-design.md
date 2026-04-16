# Connectivity Overlay System — Design Spec

**Date:** 2026-04-16
**Status:** Approved

## Overview

tradeMAX is a trading app that requires constant internet to function. This spec defines a full-screen blocking overlay system that:

1. Appears on **app startup** while services initialize
2. Appears **mid-session** when internet connectivity is lost
3. Runs an animated **reconnection sequence** when connectivity returns before dismissing

The app is completely unusable while the overlay is active — no interaction with any underlying UI.

## Architecture: Hybrid Detection (Approach C)

All detection and overlay logic lives in the **renderer process**. No IPC or main process changes required.

### Detection Strategy

- **Offline detection:** `window.addEventListener('offline')` — triggers immediately when the browser reports network loss. Show overlay instantly.
- **Online confirmation:** `window.addEventListener('online')` — when fired, do NOT dismiss the overlay. Instead, run a confirmation fetch to a reliable endpoint (e.g., `https://dns.google/resolve?name=google.com`) to verify real connectivity. Only begin the reconnection sequence after the fetch succeeds.
- **Startup detection:** On app mount, check `navigator.onLine`. If `false`, show overlay immediately. If `true`, run confirmation fetch before allowing app to proceed.
- **Polling during disconnect:** While offline, poll every 5 seconds with the confirmation fetch. If it succeeds, begin reconnection sequence even if the browser `online` event hasn't fired (covers edge cases where the event is missed).

### Why This Approach

- `navigator.onLine` / `offline` event is instant but can produce false positives on `online`
- Confirmation fetch eliminates false reconnects (captive portals, flaky WiFi)
- All renderer-side — no new IPC channels, no main process changes
- Fits the existing architecture: overlay is just a React component in `App.tsx`

## Overlay States

### State 1: Startup Boot

**Trigger:** App mounts, connectivity not yet confirmed.

**Visual:**
- Full-screen dark overlay (`--bg-base`) with subtle grid background pattern
- App logo: "tradeMAX" with red accent
- Animated progress bar (red, `--color-loss`)
- Cycling status messages with fade transition:
  1. "Connecting to servers..."
  2. "Authenticating..."
  3. "Loading portfolio..."
  4. "Syncing market data..."
- Sub-label in mono font: "INITIALIZING SERVICES"

**Behavior:**
- Progress bar animates from 0% to ~90% during startup, jumps to 100% when ready
- Messages cycle every ~2 seconds
- Once `navigator.onLine` is confirmed via fetch → overlay runs exit animation (fade out, ~400ms)
- If offline at startup → transitions to State 2 (Connection Lost)

### State 2: Connection Lost

**Trigger:** `offline` browser event fires, OR confirmation fetch fails during polling.

**Visual:**
- Full-screen dark overlay with grid background
- WiFi-off icon inside a circular border (red accent)
- Title: "Connection Lost" (red, `--color-loss`)
- Subtitle: "Attempting to reconnect..."
- Animated scanning/indeterminate progress bar (red gradient sweeping left to right)
- Retry counter in mono font: "RETRY 2 OF 10 - 4s"

**Behavior:**
- Overlay fades in (~300ms) with backdrop blur
- Progress bar runs an indeterminate animation (continuous sweep)
- Retry counter increments each polling attempt (every 5s)
- Max retries: 10 (50 seconds). After max retries, message changes to "Please check your internet connection" with no countdown, but polling continues indefinitely at 10s intervals.
- On successful confirmation fetch → transitions to State 3

### State 3: Reconnection Sequence

**Trigger:** Confirmation fetch succeeds after being disconnected.

**Visual:**
- Full-screen overlay shifts accent from red to green (`--color-profit`)
- Grid background tint shifts to green
- Checkmark icon inside circular border (green)
- Step checklist with fade-in per step:
  1. "Reconnected" (green check)
  2. "Syncing data..." (green check, after ~800ms)
  3. "Ready!" (green check, after ~800ms)
- Progress bar fills to 100% (green)

**Behavior:**
- Each step appears sequentially with ~800ms delay
- After final "Ready!" step, hold for 500ms
- Overlay fades out (~400ms)
- Total sequence: ~2.5 seconds from reconnection to full dismiss

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/components/ConnectivityOverlay.tsx` | The overlay React component with all 3 states |
| `src/renderer/hooks/useConnectivity.ts` | Custom hook: online/offline detection, confirmation fetch, polling, state machine |

### Modified Files

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Import and render `<ConnectivityOverlay />` at root level, above all other content |

### No Changes Required

- No IPC channel additions
- No main process changes
- No preload changes
- No store changes (connectivity state is local to the overlay)

## Hook: `useConnectivity`

```typescript
type ConnectivityState =
  | "checking"      // startup, not yet confirmed
  | "online"        // confirmed online
  | "offline"       // lost connection
  | "reconnecting"  // online event received, running confirmation
  | "syncing"       // confirmed back, running sync sequence

Returns: {
  state: ConnectivityState;
  retryCount: number;
  showOverlay: boolean;  // true for all states except "online"
}
```

### State Machine

```
App Mount
  └─ "checking"
       ├─ fetch succeeds → "online" (overlay dismissed)
       └─ fetch fails / navigator.onLine === false → "offline"

"online"
  └─ offline event → "offline"

"offline"
  ├─ online event → "reconnecting"
  └─ poll fetch succeeds → "reconnecting"

"reconnecting"
  ├─ confirmation fetch succeeds → "syncing"
  └─ confirmation fetch fails → "offline"

"syncing"
  └─ sequence completes (~2.5s) → "online"
```

## Overlay Component: `ConnectivityOverlay`

### Props
None. Uses `useConnectivity` hook internally.

### Rendering
- Renders a `<AnimatePresence>` wrapper
- When `showOverlay` is true, renders a `<motion.div>` with:
  - `position: fixed`, `inset: 0`, `z-index: 9999`
  - `background: var(--bg-base)`
  - `backdrop-filter: blur(20px)`
  - Framer Motion fade in/out animations
- Content switches based on `state`:
  - `checking` → Startup Boot UI
  - `offline` → Connection Lost UI
  - `reconnecting` → Connection Lost UI (same visuals, "Verifying connection...")
  - `syncing` → Reconnection Sequence UI

### Animation Details
- **Progress bar (startup):** CSS `transition: width 0.5s ease` driven by a percentage state
- **Progress bar (offline):** CSS `@keyframes` indeterminate sweep animation
- **Status message cycling:** Framer Motion `AnimatePresence` with fade transition
- **Step checklist:** Staggered `motion.div` entries with `delay` per step
- **Overlay enter/exit:** `opacity: 0→1` / `1→0`, duration 300-400ms

## Styling

- Matches existing app theme tokens (dark and light mode via CSS variables)
- Red accent (`--color-loss` / `#F43F5E`) for disconnect/error states
- Green accent (`--color-profit` / `#10B981`) for reconnection success
- Grid background pattern reuses existing `.grid-bg` class from `index.css`
- Mono font (`JetBrains Mono`) for technical labels (retry counter, sub-status)
- Inter font for status messages and titles

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| App starts while offline | Shows State 2 (Connection Lost) directly, skipping startup boot |
| Very brief disconnect (<1s) | Overlay still appears and runs full reconnection sequence — no "debounce" to avoid confusion |
| Captive portal / DNS failure | Confirmation fetch fails → stays in State 2, doesn't false-dismiss |
| Connection flaps rapidly | Each offline event re-triggers State 2; online must pass confirmation to dismiss |
| Electron loses focus while offline | Polling continues; overlay state is preserved when window regains focus |

## Testing Checklist

- [ ] App starts online → startup overlay shows briefly, then fades
- [ ] App starts offline → connection lost overlay appears immediately
- [ ] Disconnect WiFi mid-session → overlay appears within 1 second
- [ ] Reconnect WiFi → "Reconnected → Syncing → Ready" sequence plays, then fades
- [ ] Kill and restore network repeatedly → overlay handles rapid state changes without glitches
- [ ] Light theme → overlay uses light theme tokens correctly
- [ ] Overlay blocks all interaction underneath (click-through test)
