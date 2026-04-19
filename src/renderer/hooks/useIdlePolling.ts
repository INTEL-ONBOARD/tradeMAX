import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { PortfolioSnapshot, Position } from "../../shared/types";

const POLL_INTERVAL_MS = 5_000;

export function useIdlePolling() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agentRunning = useAppStore((s) => s.agentStatus.running);
  const settings = useAppStore((s) => s.settings);
  const currentScreen = useAppStore((s) => s.currentScreen);

  useEffect(() => {
    const api = window.api;
    if (!api) return;

    const canFetchIdleState =
      settings?.selectedExchange === "paper" || settings?.hasBybitKeys;
    const shouldPoll = !agentRunning && canFetchIdleState && currentScreen === "dashboard";

    if (!shouldPoll) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

      const fetchData = () => {
        api.invoke(IPC.PORTFOLIO_GET).then((p: any) => {
          useAppStore.getState().setPortfolio((p as PortfolioSnapshot | null) ?? null);
        }).catch(() => {});
      api.invoke(IPC.POSITIONS_GET).then((pos: any) => {
        useAppStore.getState().setPositions(pos as Position[]);
      }).catch(() => {});
    };

    fetchData(); // immediate fetch on start/transition
    intervalRef.current = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [agentRunning, settings, currentScreen]);
}
