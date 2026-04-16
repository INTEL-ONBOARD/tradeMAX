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
