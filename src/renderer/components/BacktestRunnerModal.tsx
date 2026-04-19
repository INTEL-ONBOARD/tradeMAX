import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Loader2 } from "./icons";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export interface BacktestRunInput {
  symbol: string;
  startDate: string;
  endDate: string;
  startingBalance: number;
}

interface BacktestProgressState {
  current: number;
  total: number;
  status: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRun: (input: BacktestRunInput) => Promise<void>;
  running: boolean;
  progress: BacktestProgressState | null;
}

function isoDate(offsetDays = 0): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().split("T")[0];
}

export function BacktestRunnerModal({
  isOpen,
  onClose,
  onRun,
  running,
  progress,
}: Props) {
  const settings = useAppStore((s) => s.settings);

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [startDate, setStartDate] = useState(isoDate(-30));
  const [endDate, setEndDate] = useState(isoDate(0));
  const [startingBalance, setStartingBalance] = useState(10000);
  const [pairs, setPairs] = useState<string[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !settings) return;

    setSymbol(settings.engineConfig?.tradingSymbol || "BTCUSDT");
    setStartingBalance(settings.engineConfig?.paperStartingBalance || 10000);
    setError(null);

    setPairsLoading(true);
    window.api.invoke(IPC.EXCHANGE_PAIRS)
      .then((result) => {
        const data = result as { pairs?: string[] };
        setPairs(data.pairs ?? []);
      })
      .catch(() => setPairs([]))
      .finally(() => setPairsLoading(false));
  }, [isOpen, settings]);

  const progressPct = useMemo(() => {
    if (!progress || progress.total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)));
  }, [progress]);

  const handleRun = async () => {
    setError(null);

    if (!symbol.trim()) {
      setError("Trading pair is required.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before end date.");
      return;
    }

    if (startingBalance < 100) {
      setError("Starting balance must be at least 100.");
      return;
    }

    try {
      await onRun({
        symbol: symbol.trim().toUpperCase(),
        startDate,
        endDate,
        startingBalance,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Backtest failed";
      setError(message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Strategy Backtest" width="520px" height="auto">
      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Trading Pair
            </span>
            {pairsLoading ? (
              <div className="h-[38px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] flex items-center px-3 text-[12px] text-[var(--text-tertiary)]">
                Loading pairs...
              </div>
            ) : pairs.length > 0 ? (
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="h-[38px] px-3 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
              >
                {pairs.map((pair) => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="h-[38px] px-3 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
              />
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Starting Balance
            </span>
            <input
              type="number"
              min={100}
              step={100}
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value) || 0)}
              className="h-[38px] px-3 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Start Date
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-[38px] px-3 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              End Date
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-[38px] px-3 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
            />
          </label>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <p className="text-[11px] text-[var(--text-secondary)]">
            Runs the current AI model and risk profile against historical Bybit candles. Use this before switching strategies or raising leverage.
          </p>
        </div>

        {(running || progress) && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mb-2">
              <span>{progress?.status ?? "Preparing backtest..."}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-inset)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-info)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-[11px] font-medium text-[var(--color-loss)]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={running}
            className="px-4 py-2 text-[12px] font-medium rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Close
          </button>
          <button
            onClick={() => void handleRun()}
            disabled={running}
            className="px-4 py-2 text-[12px] font-medium rounded-md bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Running...
              </span>
            ) : (
              "Run Backtest"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
