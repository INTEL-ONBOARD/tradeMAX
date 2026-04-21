import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { resolvePreferredTradingSymbol } from "../../shared/engineConfigUtils";
import { Crosshair, AlertTriangle, Shield, Key, CheckCircle } from "./icons";
import type { UserSettings } from "../../shared/types";

type AggressivenessPreset = "conservative" | "balanced" | "aggressive";

const PRESETS: Record<AggressivenessPreset, { label: string; desc: string; loopIntervalSec: number; minConfidence: number; tradeCooldownSec: number }> = {
  conservative: { label: "Conservative", desc: "Slower, high-confidence trades", loopIntervalSec: 15, minConfidence: 0.85, tradeCooldownSec: 60 },
  balanced:     { label: "Balanced",     desc: "Default trading behaviour",      loopIntervalSec: 8,  minConfidence: 0.75, tradeCooldownSec: 30 },
  aggressive:   { label: "Aggressive",   desc: "Faster, lower threshold",        loopIntervalSec: 4,  minConfidence: 0.60, tradeCooldownSec: 10 },
};

function detectPreset(loopSec: number, conf: number): AggressivenessPreset {
  if (loopSec >= 12 && conf >= 0.82) return "conservative";
  if (loopSec <= 5 && conf <= 0.65) return "aggressive";
  return "balanced";
}

function formatPairPrice(price?: number): string {
  if (typeof price !== "number" || !Number.isFinite(price)) return "--";
  const p = price;
  if (p >= 100) return `$${p.toFixed(2)}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.01) return `$${p.toFixed(6)}`;
  return `$${p.toFixed(8)}`;
}

type DraftState = {
  pair: string;
  autoPair: boolean;
  riskPct: number;
  mode: "spot" | "futures";
  preset: AggressivenessPreset;
  maxPositions: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ── Pair Picker Modal ──────────────────────────────── */
function PairPickerModal({
  isOpen,
  onClose,
  pairs,
  prices,
  selected,
  onSelect,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  pairs: string[];
  prices: Record<string, number>;
  selected: string;
  onSelect: (v: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) setSearch("");
  }, [isOpen]);

  const filtered = pairs.filter((p) => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Pair" width="420px" height="460px">
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pair..."
            autoFocus
            className="w-full px-3 py-2 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-secondary)]"
          />
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
            Live list refreshes every 10s
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 bg-[var(--bg-base)]">
          {loading ? (
            <p className="text-[12px] text-[var(--text-tertiary)] text-center py-6">Loading pairs...</p>
          ) : filtered.length === 0 ? (
            <p className="text-[12px] text-[var(--text-tertiary)] text-center py-6">No pairs found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((symbol) => {
                const active = symbol === selected;
                return (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => {
                      onSelect(symbol);
                      onClose();
                    }}
                    className={`w-full px-3 py-2 rounded-md border text-left text-[12px] font-medium transition-colors ${
                      active
                        ? "border-[var(--text-primary)] bg-[var(--bg-overlay)] text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{symbol}</span>
                      <span className={`${active ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"} text-[11px] tabular-nums whitespace-nowrap`}>
                        {formatPairPrice(prices[symbol])}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ── Not-configured Overlay ──────────────────────────── */
function NotConfiguredOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: "var(--bg-base)", opacity: 0.97 }}>
      <div className="flex flex-col items-center text-center px-8 max-w-xs">
        <div className="w-14 h-14 rounded-full bg-[var(--color-warn)]/10 flex items-center justify-center mb-4">
          <AlertTriangle size={28} className="text-[var(--color-warn)]" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">Setup Required</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-1.5">
          Please configure your <strong>Exchange API keys</strong> and <strong>OpenAI API key</strong> before using the trading agent.
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)] mb-5">
          Go to <span className="inline-flex items-center gap-0.5"><Shield size={10} /> Settings</span> &gt; <span className="inline-flex items-center gap-0.5"><Key size={10} /> API & Auth</span> to add your keys.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-overlay)] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/* ── Main Modal ──────────────────────────────────────── */
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentConfigModal({ isOpen, onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  // Local state
  const [pair, setPair] = useState("BTCUSDT");
  const [autoPair, setAutoPair] = useState(false);
  const [riskPct, setRiskPct] = useState(2);
  const [mode, setMode] = useState<"spot" | "futures">("spot");
  const [preset, setPreset] = useState<AggressivenessPreset>("balanced");
  const [maxPositions, setMaxPositions] = useState(3);
  const [saving, setSaving] = useState(false);
  const [pairPickerOpen, setPairPickerOpen] = useState(false);

  // Exchange pairs fetched from backend
  const [exchangePairs, setExchangePairs] = useState<string[]>([]);
  const [exchangePairPrices, setExchangePairPrices] = useState<Record<string, number>>({});
  const [pairsLoading, setPairsLoading] = useState(false);
  // null = still checking, true = ready, false = not configured
  const [configStatus, setConfigStatus] = useState<null | boolean>(null);
  const initialDraftRef = useRef<DraftState | null>(null);
  const pairFetchSeqRef = useRef(0);

  const currentDraft: DraftState = useMemo(() => ({
    pair,
    autoPair,
    riskPct,
    mode,
    preset,
    maxPositions,
  }), [pair, autoPair, riskPct, mode, preset, maxPositions]);

  const dirty = useMemo(() => {
    const initial = initialDraftRef.current;
    if (!initial) return false;
    return (
      initial.pair !== currentDraft.pair ||
      initial.autoPair !== currentDraft.autoPair ||
      initial.riskPct !== currentDraft.riskPct ||
      initial.mode !== currentDraft.mode ||
      initial.preset !== currentDraft.preset ||
      initial.maxPositions !== currentDraft.maxPositions
    );
  }, [currentDraft]);

  const fetchPairsForMode = useCallback(async (targetMode: "spot" | "futures", opts?: { blocking?: boolean }) => {
    if (!settings) return;

    const hasOpenAIKey = settings.hasOpenAIKey;
    if (!hasOpenAIKey) {
      setConfigStatus(false);
      setExchangePairs([]);
      setExchangePairPrices({});
      setPairsLoading(false);
      return;
    }

    const requestId = ++pairFetchSeqRef.current;
    setPairsLoading(true);
    if (opts?.blocking) setConfigStatus(null);

    try {
      const result = await window.api.invoke(IPC.EXCHANGE_PAIRS, { mode: targetMode });
      if (requestId !== pairFetchSeqRef.current) return;
      const res = result as { configured: boolean; pairs: string[]; prices?: Record<string, number | string> };
      const pairs = Array.isArray(res.pairs) ? res.pairs : [];
      setConfigStatus(res.configured && hasOpenAIKey);
      setExchangePairs(pairs);
      const rawPrices = res.prices ?? {};
      const nextPrices: Record<string, number> = {};
      for (const [symbol, raw] of Object.entries(rawPrices)) {
        const parsed = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
        if (Number.isFinite(parsed) && parsed > 0) {
          nextPrices[symbol.toUpperCase()] = parsed;
        }
      }
      setExchangePairPrices(nextPrices);
      setPair((prev) => {
        if (!pairs.length) return prev;
        return pairs.includes(prev) ? prev : pairs[0];
      });
    } catch {
      if (requestId !== pairFetchSeqRef.current) return;
      setConfigStatus(false);
      setExchangePairs([]);
      setExchangePairPrices({});
    } finally {
      if (requestId === pairFetchSeqRef.current) setPairsLoading(false);
    }
  }, [settings]);

  // Sync from settings and run initial config-aware pair fetch on open
  useEffect(() => {
    if (!isOpen) {
      // Reset to unknown when modal closes so next open re-checks
      setConfigStatus(null);
      setPairPickerOpen(false);
      setExchangePairPrices({});
      pairFetchSeqRef.current += 1;
      return;
    }
    if (!settings) return;

    setPair(resolvePreferredTradingSymbol(settings.engineConfig));
    setAutoPair(settings.engineConfig?.autoPairSelection || false);
    setRiskPct(settings.riskProfile?.maxRiskPct || 2);
    setMode(settings.tradingMode || "spot");
    setMaxPositions(settings.riskProfile?.maxOpenPositions || 3);
    const resolvedPreset = detectPreset(
      settings.engineConfig?.loopIntervalSec || 8,
      settings.riskProfile?.minConfidence || 0.75,
    );
    setPreset(resolvedPreset);

    initialDraftRef.current = {
      pair: resolvePreferredTradingSymbol(settings.engineConfig),
      autoPair: settings.engineConfig?.autoPairSelection || false,
      riskPct: settings.riskProfile?.maxRiskPct || 2,
      mode: settings.tradingMode || "spot",
      preset: resolvedPreset,
      maxPositions: settings.riskProfile?.maxOpenPositions || 3,
    };

    void fetchPairsForMode(settings.tradingMode || "spot", { blocking: true });
  }, [isOpen, settings, fetchPairsForMode]);

  // Live refresh pair list while manual pair picker is open.
  useEffect(() => {
    if (!isOpen || !pairPickerOpen || autoPair || !settings?.hasOpenAIKey) return;
    void fetchPairsForMode(mode);
    const interval = window.setInterval(() => {
      void fetchPairsForMode(mode);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [isOpen, pairPickerOpen, autoPair, mode, settings?.hasOpenAIKey, fetchPairsForMode]);

  const handleModeChange = (nextMode: "spot" | "futures") => {
    if (mode === nextMode) return;
    setMode(nextMode);
    if (isOpen && settings?.hasOpenAIKey) {
      void fetchPairsForMode(nextMode);
    }
  };

  const resetToLoaded = () => {
    const initial = initialDraftRef.current;
    if (!initial) return;
    setPair(initial.pair);
    setAutoPair(initial.autoPair);
    setRiskPct(initial.riskPct);
    setMode(initial.mode);
    setPreset(initial.preset);
    setMaxPositions(initial.maxPositions);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const p = PRESETS[preset];
      const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
        tradingMode: mode,
        riskProfile: {
          maxRiskPct: riskPct,
          maxOpenPositions: maxPositions,
          minConfidence: p.minConfidence,
        },
        engineConfig: {
          tradingSymbol: pair,
          autoPairSelection: autoPair,
          ...(autoPair ? { restrictAutoPairSelectionToShortlist: false } : {}),
          loopIntervalSec: p.loopIntervalSec,
          tradeCooldownSec: p.tradeCooldownSec,
        },
      }) as UserSettings;
      if (updated) setSettings(updated);
      initialDraftRef.current = { ...currentDraft };
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const riskFillPct = ((riskPct - 0.5) / 9.5) * 100;
  const riskTone = riskPct <= 1.5 ? "Low exposure" : riskPct <= 3.5 ? "Balanced exposure" : "High exposure";
  const canApply = configStatus === true && dirty && (autoPair || Boolean(pair.trim()));

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Agent Configuration" width="540px" height="auto">
        <div className="relative flex flex-col">
        {/* Loading state while checking configuration */}
        {configStatus === null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-tertiary)]">Checking configuration...</p>
            </div>
          </div>
        )}

        {/* Not-configured overlay */}
        {configStatus === false && <NotConfiguredOverlay onClose={onClose} />}

        <div className="p-3 space-y-2">
          <section className="space-y-2">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">Mode & Strategy</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-[var(--text-secondary)]">Trading Mode</span>
              <div className="grid grid-cols-2 gap-2">
                {(["spot", "futures"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium uppercase ${mode === m ? "border-[var(--text-primary)] bg-[var(--bg-overlay)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-[var(--text-secondary)]">Strategy Style</span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESETS) as AggressivenessPreset[]).map((key) => {
                  const active = preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium text-center ${active ? "border-[var(--text-primary)] bg-[var(--bg-overlay)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}
                    >
                      {PRESETS[key].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-2 border-t border-[var(--border)] pt-2.5">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Crosshair size={12} className="text-[var(--text-tertiary)]" />
                Market Selection
              </p>
            </div>

            <div className="inline-flex p-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)]">
              <button
                type="button"
                onClick={() => setAutoPair(true)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${autoPair ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
              >
                Auto Pair
              </button>
              <button
                type="button"
                onClick={() => setAutoPair(false)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${!autoPair ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
              >
                Manual Pair
              </button>
            </div>

            {autoPair ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                Running Agent Mode
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPairPickerOpen(true)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--text-secondary)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">{pair || "Select trading pair"}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                    {pairsLoading ? "Loading..." : formatPairPrice(exchangePairPrices[pair])}
                  </span>
                </div>
              </button>
            )}
          </section>

          <section className="space-y-2 border-t border-[var(--border)] pt-2.5">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">Risk Limits</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-secondary)]">Trade Volume</span>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{riskPct.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={riskPct}
                  onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--text-primary) 0%, var(--text-primary) ${riskFillPct}%, var(--bg-inset) ${riskFillPct}%, var(--bg-inset) 100%)`,
                  }}
                />
                <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                  <span>0.5%</span>
                  <span>{riskTone}</span>
                  <span>10</span>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-secondary)]">Max Open Trades</span>
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{maxPositions}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={maxPositions}
                  onChange={(e) => setMaxPositions(clamp(parseInt(e.target.value, 10), 1, 10))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--text-primary) 0%, var(--text-primary) ${((maxPositions - 1) / 9) * 100}%, var(--bg-inset) ${((maxPositions - 1) / 9) * 100}%, var(--bg-inset) 100%)`,
                  }}
                />
                <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                  <span>1</span>
                  <span>{maxPositions <= 3 ? "Focused" : maxPositions <= 6 ? "Balanced" : "Broad"}</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div className="shrink-0 px-3 py-2 border-t border-[var(--border)] flex items-center justify-between gap-2" style={{ background: "var(--bg-surface)" }}>
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-warn)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-warn)]" />
                Unsaved changes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--color-profit)]">
                <CheckCircle size={11} />
                No pending changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetToLoaded}
              disabled={!dirty || saving}
              className="px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border)] rounded-md hover:bg-[var(--bg-overlay)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canApply}
              className="px-4 py-1.5 text-[11px] font-semibold text-[var(--text-inverse)] bg-[var(--text-primary)] rounded-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Apply"}
            </button>
          </div>
        </div>
        </div>
      </Modal>
      <PairPickerModal
        isOpen={isOpen && pairPickerOpen}
        onClose={() => setPairPickerOpen(false)}
        pairs={exchangePairs}
        prices={exchangePairPrices}
        selected={pair}
        onSelect={setPair}
        loading={pairsLoading}
      />
    </>
  );
}
