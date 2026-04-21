import { useState, useEffect, useRef } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Crosshair, Minus, Plus, ChevronDown, AlertTriangle, Shield, Key } from "./icons";
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

/* ── Searchable Dropdown ─────────────────────────────── */
function PairDropdown({ pairs, value, onChange, loading }: {
  pairs: string[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = pairs.filter((p) =>
    p.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--text-tertiary)] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {loading ? "Loading pairs..." : value || "Select pair"}
        </span>
        <ChevronDown size={14} className={`text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--border)] shadow-xl overflow-hidden" style={{ background: "var(--bg-base)" }}>
          {/* Search input */}
          <div className="p-2 border-b border-[var(--border)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pairs..."
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-tertiary)]"
            />
          </div>
          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-[var(--text-tertiary)] text-center">No pairs found</p>
            ) : (
              filtered.slice(0, 80).map((p) => (
                <button
                  key={p}
                  onClick={() => { onChange(p); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                    p === value
                      ? "bg-[var(--color-loss)]/10 text-[var(--color-loss)] font-bold"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {p}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
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

  // Exchange pairs fetched from backend
  const [exchangePairs, setExchangePairs] = useState<string[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  // null = still checking, true = ready, false = not configured
  const [configStatus, setConfigStatus] = useState<null | boolean>(null);

  // Sync from settings + fetch pairs when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset to unknown when modal closes so next open re-checks
      setConfigStatus(null);
      return;
    }
    if (!settings) return;

    setPair(settings.engineConfig?.tradingSymbol || "BTCUSDT");
    setAutoPair(settings.engineConfig?.autoPairSelection || false);
    setRiskPct(settings.riskProfile?.maxRiskPct || 2);
    setMode(settings.tradingMode || "spot");
    setMaxPositions(settings.riskProfile?.maxOpenPositions || 3);
    setPreset(detectPreset(
      settings.engineConfig?.loopIntervalSec || 8,
      settings.riskProfile?.minConfidence || 0.75,
    ));

    const hasOpenAIKey = settings.hasOpenAIKey;

    // Quick check: if we already know the AI key is missing, show overlay immediately
    if (!hasOpenAIKey) {
      setConfigStatus(false);
      return;
    }

    // Fetch available pairs from exchange (also checks if keys exist)
    setPairsLoading(true);
    setConfigStatus(null);
    window.api.invoke(IPC.EXCHANGE_PAIRS)
      .then((result) => {
        const res = result as { configured: boolean; pairs: string[] };
        setConfigStatus(res.configured && !!hasOpenAIKey);
        setExchangePairs(res.pairs);
      })
      .catch(() => {
        setConfigStatus(false);
        setExchangePairs([]);
      })
      .finally(() => setPairsLoading(false));
  }, [isOpen, settings]);

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
          loopIntervalSec: p.loopIntervalSec,
          tradeCooldownSec: p.tradeCooldownSec,
        },
      }) as UserSettings;
      if (updated) setSettings(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Agent Configuration" width="400px" height="auto">
      <div className="relative">
        {/* Loading state while checking configuration */}
        {configStatus === null && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ background: "var(--bg-base)" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[var(--text-tertiary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-tertiary)]">Checking configuration...</p>
            </div>
          </div>
        )}

        {/* Not-configured overlay */}
        {configStatus === false && <NotConfiguredOverlay onClose={onClose} />}

        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: "70vh" }}>

          {/* ── Currency Pair ─────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Crosshair size={12} className="text-[var(--text-tertiary)]" />
                Currency Pair
              </label>
              {/* Auto pair toggle */}
              <button
                onClick={() => setAutoPair(!autoPair)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                  autoPair
                    ? "bg-[var(--color-profit)] text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    : "bg-[var(--bg-inset)] text-[var(--text-tertiary)] border border-[var(--border)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoPair ? "bg-white" : "bg-[var(--text-tertiary)]"}`} />
                Auto Pair
              </button>
            </div>

            {autoPair ? (
              <div className="flex items-center justify-center py-3 rounded-lg border border-dashed border-[var(--color-profit)]" style={{ background: "rgba(16,185,129,0.05)" }}>
                <p className="text-xs text-[var(--color-profit)] font-medium">The AI will rank the configured candidate symbols and trade the best portfolio opportunities</p>
              </div>
            ) : (
              <PairDropdown
                pairs={exchangePairs}
                value={pair}
                onChange={setPair}
                loading={pairsLoading}
              />
            )}
          </div>

          {/* ── Trade Volume (Risk %) ────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Trade Volume
              </label>
              <span className="text-sm font-bold text-[var(--text-primary)]">
                {riskPct.toFixed(1)}%
                <span className="text-[10px] text-[var(--text-tertiary)] font-normal ml-1">per trade</span>
              </span>
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
                background: `linear-gradient(to right, var(--color-profit) 0%, var(--color-profit) ${((riskPct - 0.5) / 9.5) * 100}%, var(--bg-inset) ${((riskPct - 0.5) / 9.5) * 100}%, var(--bg-inset) 100%)`,
              }}
            />
            <div className="flex justify-between text-[9px] text-[var(--text-tertiary)] mt-1">
              <span>Safe (0.5%)</span>
              <span>Bold (10%)</span>
            </div>
          </div>

          {/* ── Trading Mode ─────────────────────────── */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block mb-2">
              Trading Mode
            </label>
            <div className="flex gap-2">
              {(["spot", "futures"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    mode === m
                      ? "bg-[var(--text-primary)] text-[var(--text-inverse)] shadow-md"
                      : "bg-[var(--bg-inset)] text-[var(--text-tertiary)] border border-[var(--border)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* ── Aggressiveness ───────────────────────── */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block mb-2">
              Strategy Style
            </label>
            <div className="flex gap-2">
              {(Object.keys(PRESETS) as AggressivenessPreset[]).map((key) => {
                const p = PRESETS[key];
                const active = preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPreset(key)}
                    className={`flex-1 py-2 px-1 rounded-lg text-center transition-all ${
                      active
                        ? key === "aggressive"
                          ? "bg-[var(--color-loss)] text-white shadow-md"
                          : key === "conservative"
                            ? "bg-[var(--color-profit)] text-white shadow-md"
                            : "bg-[var(--text-primary)] text-[var(--text-inverse)] shadow-md"
                        : "bg-[var(--bg-inset)] border border-[var(--border)] hover:bg-[var(--bg-overlay)]"
                    }`}
                  >
                    <p className={`text-[11px] font-bold ${active ? "" : "text-[var(--text-secondary)]"}`}>{p.label}</p>
                    <p className={`text-[9px] mt-0.5 ${active ? "opacity-80" : "text-[var(--text-tertiary)]"}`}>{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Max Positions ────────────────────────── */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Max Open Trades
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMaxPositions(Math.max(1, maxPositions - 1))}
                  className="w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="text-lg font-bold text-[var(--text-primary)] w-6 text-center tabular-nums">
                  {maxPositions}
                </span>
                <button
                  onClick={() => setMaxPositions(Math.min(10, maxPositions + 1))}
                  className="w-7 h-7 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div className="shrink-0 px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2" style={{ background: "var(--bg-surface)" }}>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border)] rounded-lg hover:bg-[var(--bg-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || configStatus !== true}
            className="px-5 py-2 text-xs font-bold text-white bg-[var(--color-loss)] rounded-lg hover:brightness-110 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
