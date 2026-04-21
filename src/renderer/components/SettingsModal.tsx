import { useState, useRef, useCallback, useEffect } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Settings, Shield, Edit3, Monitor, CheckCircle, Loader2, Eye, EyeOff } from "./icons";
import type { ClosedPnlRecord, PortfolioSnapshot, Position, ProfileConfigRecord, UserSettings } from "../../shared/types";

function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  return useCallback((...args: any[]) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as unknown as T;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RevealedKeysPayload = {
  openaiApiKey: string;
  bybitApiKey: string;
  bybitApiSecret: string;
};

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
      <div>
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{label}</p>
        {description && <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const debouncedOnChange = useDebouncedCallback(onChange, 400);

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      type="number"
      value={local}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= min && v <= max) {
          setLocal(v);
          debouncedOnChange(v);
        }
      }}
      className="w-24 px-2 py-1.5 text-[12px] text-right rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
    />
  );
}

function TextInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const debouncedOnChange = useDebouncedCallback(onChange, 500);

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
        debouncedOnChange(e.target.value);
      }}
      className={className ?? "w-40 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-[22px] rounded-full relative transition-colors ${checked ? "bg-[var(--color-profit)]" : "bg-[var(--bg-inset)] border border-[var(--border)]"}`}
    >
      <div
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "left-[22px]" : "left-[3px]"}`}
      />
    </button>
  );
}

function SelectInput({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-fit min-w-[6rem] px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
  labels,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-inset)] p-1">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${active ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {labels?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
  );
}

function SliderInput({
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  minLabel,
  maxLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
}) {
  const [local, setLocal] = useState(value);
  const debouncedOnChange = useDebouncedCallback(onChange, 250);

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="w-[280px] space-y-2">
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-[var(--text-tertiary)]">{minLabel ?? formatValue(min)}</span>
        <span className="px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium">
          {formatValue(local)}
        </span>
        <span className="text-[var(--text-tertiary)]">{maxLabel ?? formatValue(max)}</span>
      </div>
      <input
        type="range"
        value={local}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = parseFloat(e.target.value);
          setLocal(next);
          debouncedOnChange(next);
        }}
        className="w-full cursor-pointer"
        style={{ accentColor: "var(--primary-500)" }}
      />
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function formatSeconds(value: number) {
  if (value === 0) return "Off";
  if (value < 60) return `${Math.round(value)} sec`;
  if (value % 60 === 0) return `${Math.round(value / 60)} min`;
  return `${(value / 60).toFixed(1)} min`;
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function PasswordInput({
  value,
  placeholder,
  onChange,
  onFocus,
  className,
  type = "password",
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  className?: string;
  type?: "password" | "text";
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      className={className ?? "w-48 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"}
    />
  );
}

function SaveButton({
  onClick,
  disabled,
  saved,
  saving,
  label,
  savingLabel = "Saving...",
  savedLabel = "Saved",
  iconOnly = false,
}: {
  onClick: () => void;
  disabled: boolean;
  saved: boolean;
  saving?: boolean;
  label: string;
  savingLabel?: string;
  savedLabel?: string;
  iconOnly?: boolean;
}) {
  const title = saving ? savingLabel : saved ? savedLabel : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`${iconOnly ? "w-8 h-8 p-0 inline-flex items-center justify-center" : "px-3 py-1.5 text-[11px]"} font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
      style={{
        background: saved ? "var(--color-profit-bg)" : "var(--color-info-bg)",
        color: saved ? "var(--color-profit)" : "var(--color-info)",
        border: `1px solid ${saved ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
      }}
    >
      {saving ? (
        iconOnly ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> {savingLabel}</span>
        )
      ) : saved ? (
        iconOnly ? (
          <CheckCircle size={13} />
        ) : (
          <span className="flex items-center gap-1"><CheckCircle size={11} /> {savedLabel}</span>
        )
      ) : (
        iconOnly ? <CheckCircle size={13} /> : label
      )}
    </button>
  );
}

function StatusBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Not configured",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
      style={{
        color: active ? "var(--color-profit)" : "var(--text-secondary)",
        borderColor: active ? "var(--color-profit-border)" : "var(--border)",
        background: active ? "var(--color-profit-bg)" : "var(--bg-inset)",
      }}
    >
      {active && <CheckCircle size={10} />}
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function SettingsTabLoadingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute -inset-px z-50 overflow-hidden pointer-events-auto">
      <div className="absolute inset-0 bg-[var(--bg-surface)]/96 backdrop-blur-[20px]" />
      <div className="absolute inset-0 bg-[var(--bg-surface)]/72" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-[12px] text-[var(--text-secondary)] shadow-lg text-center">
          <Loader2 size={13} className="animate-spin" />
          {label}
        </div>
      </div>
    </div>
  );
}

function ExchangeKeyRow({
  exchange,
  onRevealStateChange,
}: {
  exchange: "bybit";
  onRevealStateChange?: (busy: boolean) => void;
}) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setPortfolio = useAppStore((s) => s.setPortfolio);
  const setPositions = useAppStore((s) => s.setPositions);
  const setExchangeHistory = useAppStore((s) => s.setExchangeHistory);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const bybitPrefetchedRef = useRef(false);

  const hasKeys = settings?.hasBybitKeys;

  useEffect(() => {
    onRevealStateChange?.(revealing);
    return () => onRevealStateChange?.(false);
  }, [revealing, onRevealStateChange]);

  const handleSave = async () => {
    if (!apiKey || !apiSecret) return;
    setSaving(true);
    setError(null);
    try {
      const result = await window.api.invoke(IPC.SETTINGS_SAVE_API_KEYS, {
        exchange, apiKey, apiSecret,
      }) as { settings: any; portfolio: any };
      setSettings(result.settings);
      setPortfolio(result.portfolio);
      if (result.settings?.selectedExchange === exchange) {
        const [positions, closedPnl] = await Promise.all([
          window.api.invoke(IPC.POSITIONS_GET).catch(() => []),
          window.api.invoke(IPC.EXCHANGE_CLOSED_PNL).catch(() => []),
        ]);
        setPositions((positions as Position[]) ?? []);
        setExchangeHistory((closedPnl as ClosedPnlRecord[]) ?? []);
      }
      setShowApiKey(false);
      setShowApiSecret(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message ?? "Validation failed");
    } finally {
      setSaving(false);
    }
  };

  const ensureStoredBybitKeys = useCallback(async (): Promise<boolean> => {
    if (hasKeys && !apiKey && !apiSecret) {
      setRevealing(true);
      setError(null);
      try {
        const revealed = await window.api.invoke(IPC.SETTINGS_REVEAL_KEYS) as RevealedKeysPayload;
        setApiKey(revealed.bybitApiKey ?? "");
        setApiSecret(revealed.bybitApiSecret ?? "");
      } catch (err: any) {
        setError(err?.message ?? "Failed to reveal saved keys");
        return false;
      } finally {
        setRevealing(false);
      }
    }
    return true;
  }, [hasKeys, apiKey, apiSecret]);

  useEffect(() => {
    if (!hasKeys || bybitPrefetchedRef.current) return;
    bybitPrefetchedRef.current = true;
    void ensureStoredBybitKeys();
  }, [hasKeys, ensureStoredBybitKeys]);

  const toggleApiKeyVisibility = async () => {
    if (!showApiKey) {
      const ok = await ensureStoredBybitKeys();
      if (!ok) return;
    }
    setShowApiKey((prev) => !prev);
  };

  const toggleApiSecretVisibility = async () => {
    if (!showApiSecret) {
      const ok = await ensureStoredBybitKeys();
      if (!ok) return;
    }
    setShowApiSecret((prev) => !prev);
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">Bybit Credentials</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Required only when Bybit is selected as the active execution venue.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <StatusBadge active={Boolean(hasKeys)} />
        </div>
      </div>
      <div className="mt-2">
        <SettingRow label="API Key" description={`Your ${exchange} API key`}>
          <div className="relative w-64">
            <PasswordInput
              value={apiKey}
              placeholder={hasKeys ? "••••••••••••" : "Enter API key"}
              type={showApiKey ? "text" : "password"}
              onFocus={() => { void ensureStoredBybitKeys(); }}
              className="w-full pr-9 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
              onChange={(v) => { setApiKey(v); setError(null); }}
            />
            <button
              type="button"
              onClick={() => void toggleApiKeyVisibility()}
              disabled={revealing || (!hasKeys && !apiKey)}
              title={showApiKey ? "Hide API key" : "Show API key"}
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {revealing ? <Loader2 size={13} className="animate-spin" /> : showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </SettingRow>
        <SettingRow label="API Secret" description={`Your ${exchange} API secret`}>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <PasswordInput
                value={apiSecret}
                placeholder={hasKeys ? "••••••••••••" : "Enter API secret"}
                type={showApiSecret ? "text" : "password"}
                onFocus={() => { void ensureStoredBybitKeys(); }}
                className="w-full pr-9 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                onChange={(v) => { setApiSecret(v); setError(null); }}
              />
              <button
                type="button"
                onClick={() => void toggleApiSecretVisibility()}
                disabled={revealing || (!hasKeys && !apiSecret)}
                title={showApiSecret ? "Hide API secret" : "Show API secret"}
                aria-label={showApiSecret ? "Hide API secret" : "Show API secret"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {revealing ? <Loader2 size={13} className="animate-spin" /> : showApiSecret ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <SaveButton
              onClick={handleSave}
              disabled={!apiKey || !apiSecret || saving}
              saving={saving}
              saved={saved}
              label="Validate & Save"
              savingLabel="Validating..."
              savedLabel="Validated"
              iconOnly
            />
          </div>
        </SettingRow>
      </div>
      {error && (
        <div className="pt-2">
          <p className="text-[11px] text-[var(--color-loss)] font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

function APIKeysTab({
  onLoadingStateChange,
}: {
  onLoadingStateChange?: (busy: boolean, label?: string) => void;
}) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setPortfolio = useAppStore((s) => s.setPortfolio);
  const setPositions = useAppStore((s) => s.setPositions);
  const setExchangeHistory = useAppStore((s) => s.setExchangeHistory);
  const agentRunning = useAppStore((s) => s.agentStatus.running);

  const [openaiKey, setOpenaiKey] = useState("");
  const [savedOpenAI, setSavedOpenAI] = useState(false);
  const [savingOpenAI, setSavingOpenAI] = useState(false);
  const [openaiError, setOpenaiError] = useState<string | null>(null);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [revealingOpenAIKey, setRevealingOpenAIKey] = useState(false);
  const openAIPrefetchedRef = useRef(false);
  const [revealingBybitKeys, setRevealingBybitKeys] = useState(false);
  const [switchingExchange, setSwitchingExchange] = useState(false);

  const refreshRuntimeState = async () => {
    const [portfolio, positions, closedPnl] = await Promise.all([
      window.api.invoke(IPC.PORTFOLIO_GET).catch(() => null),
      window.api.invoke(IPC.POSITIONS_GET).catch(() => []),
      window.api.invoke(IPC.EXCHANGE_CLOSED_PNL).catch(() => []),
    ]);

    setPortfolio((portfolio as PortfolioSnapshot | null) ?? null);
    setPositions((positions as Position[]) ?? []);
    setExchangeHistory((closedPnl as ClosedPnlRecord[]) ?? []);
  };

  const handleSaveOpenAI = async () => {
    if (!openaiKey) return;
    setSavingOpenAI(true);
    setOpenaiError(null);
    try {
      const updated = await window.api.invoke(IPC.SETTINGS_SAVE_OPENAI_KEY, { openaiApiKey: openaiKey });
      setSettings(updated as UserSettings);
      setShowOpenAIKey(false);
      setSavedOpenAI(true);
      setTimeout(() => setSavedOpenAI(false), 2500);
    } catch (err: any) {
      setOpenaiError(err?.message ?? "Validation failed");
    } finally {
      setSavingOpenAI(false);
    }
  };

  const ensureStoredOpenAIKey = useCallback(async (): Promise<boolean> => {
    if (settings?.hasOpenAIKey && !openaiKey) {
      setRevealingOpenAIKey(true);
      setOpenaiError(null);
      try {
        const revealed = await window.api.invoke(IPC.SETTINGS_REVEAL_KEYS) as RevealedKeysPayload;
        setOpenaiKey(revealed.openaiApiKey ?? "");
      } catch (err: any) {
        setOpenaiError(err?.message ?? "Failed to reveal saved OpenAI key");
        return false;
      } finally {
        setRevealingOpenAIKey(false);
      }
    }
    return true;
  }, [settings?.hasOpenAIKey, openaiKey]);

  useEffect(() => {
    if (!settings?.hasOpenAIKey || openAIPrefetchedRef.current) return;
    openAIPrefetchedRef.current = true;
    void ensureStoredOpenAIKey();
  }, [settings?.hasOpenAIKey, ensureStoredOpenAIKey]);

  const handleToggleOpenAIVisibility = async () => {
    if (showOpenAIKey) {
      setShowOpenAIKey(false);
      return;
    }

    const ok = await ensureStoredOpenAIKey();
    if (!ok) return;
    setShowOpenAIKey(true);
  };

  const handleExchangeChange = async (exchange: "bybit" | "paper") => {
    if (!settings || settings.selectedExchange === exchange) return;

    setSwitchingExchange(true);
    try {
      const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
        selectedExchange: exchange,
      }) as UserSettings;

      setSettings(updated);

      if (exchange === "paper" || updated.hasBybitKeys) {
        await refreshRuntimeState();
      } else {
        setPortfolio(null);
        setPositions([]);
        setExchangeHistory([]);
      }
    } finally {
      setSwitchingExchange(false);
    }
  };

  useEffect(() => {
    const isBusy = revealingOpenAIKey || revealingBybitKeys;
    onLoadingStateChange?.(isBusy, "Loading saved keys...");
    return () => onLoadingStateChange?.(false);
  }, [revealingOpenAIKey, revealingBybitKeys, onLoadingStateChange]);

  return (
    <div className="space-y-6">
        <div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Execution Venue
          </h3>
        </div>
        <SettingRow
          label="Trading Exchange"
          description="Choose between live Bybit execution and local paper simulation"
        >
          <div className="flex items-center gap-2 p-1 bg-[var(--bg-inset)] rounded-lg border border-[var(--border)]">
            {(["paper", "bybit"] as const).map((exchange) => {
              const active = settings?.selectedExchange === exchange;
              const label = exchange === "paper" ? "Paper" : "Bybit";
              return (
                <button
                  key={exchange}
                  onClick={() => void handleExchangeChange(exchange)}
                  disabled={switchingExchange || agentRunning}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    active ? "bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </SettingRow>
        <p className="text-[11px] text-[var(--text-tertiary)] px-1">
          {settings?.selectedExchange === "paper"
            ? "Paper mode uses public market data with simulated fills and no exchange API keys."
            : "Bybit mode uses your validated exchange credentials for real balances and live execution."}
        </p>
        {agentRunning && (
          <p className="text-[11px] text-[var(--color-warn)] px-1 mt-2">
            Stop the agent before changing the execution venue.
          </p>
        )}
      </div>

      {/* OpenAI Key */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            OpenAI API Key
          </h3>
        </div>
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">OpenAI Credentials</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {settings?.hasOpenAIKey
                  ? "Key is active and encrypted locally."
                  : "Required for GPT-powered trade analysis."}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <StatusBadge active={Boolean(settings?.hasOpenAIKey)} />
            </div>
          </div>
          <div className="mt-2">
            <SettingRow
              label="API Key"
              description="Project key used by analysis, review, and memory workflows"
            >
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <PasswordInput
                    value={openaiKey}
                    placeholder={settings?.hasOpenAIKey ? "••••••••••••" : "sk-proj-..."}
                    type={showOpenAIKey ? "text" : "password"}
                    onFocus={() => { void ensureStoredOpenAIKey(); }}
                    className="w-full pr-9 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                    onChange={(v) => { setOpenaiKey(v); setOpenaiError(null); }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleToggleOpenAIVisibility()}
                    disabled={revealingOpenAIKey || (!settings?.hasOpenAIKey && !openaiKey)}
                    title={showOpenAIKey ? "Hide OpenAI key" : "Show OpenAI key"}
                    aria-label={showOpenAIKey ? "Hide OpenAI key" : "Show OpenAI key"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {revealingOpenAIKey ? <Loader2 size={13} className="animate-spin" /> : showOpenAIKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <SaveButton
                  onClick={handleSaveOpenAI}
                  disabled={!openaiKey || savingOpenAI}
                  saving={savingOpenAI}
                  saved={savedOpenAI}
                  label="Validate & Save"
                  savingLabel="Validating..."
                  savedLabel="Validated"
                  iconOnly
                />
              </div>
            </SettingRow>
          </div>
          {openaiError && (
            <div className="pt-2">
              <p className="text-[11px] text-[var(--color-loss)] font-medium">{openaiError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bybit */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Bybit API Keys
          </h3>
        </div>
        <div className="mt-3">
          <ExchangeKeyRow
            exchange="bybit"
            onRevealStateChange={setRevealingBybitKeys}
          />
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState("general");
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "api",     label: "API & Auth", icon: Shield },
    { id: "risk",    label: "Risk Profile", icon: Edit3 },
    { id: "engine",  label: "Engine", icon: Monitor },
  ];

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [apiTabLoading, setApiTabLoading] = useState(false);
  const [apiTabLoadingLabel, setApiTabLoadingLabel] = useState("Loading saved keys...");
  const [showAdvancedEngine, setShowAdvancedEngine] = useState(false);
  const [profileConfigs, setProfileConfigs] = useState<ProfileConfigRecord[]>([]);
  const [profilePresetName, setProfilePresetName] = useState("");
  const [profileActionState, setProfileActionState] = useState<"idle" | "loading" | "saving" | "applying" | "deleting">("idle");
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [aiModels, setAiModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const showSaved = () => {
    setSaveStatus("saved");
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const showError = () => {
    setSaveStatus("idle");
  };

  const updateRiskProfile = async (field: string, value: number) => {
    setSaveStatus("saving");
    try {
      const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
        riskProfile: { [field]: value },
      }) as UserSettings;
      if (updated) setSettings(updated);
      showSaved();
    } catch {
      showError();
    }
  };

  const updateEngineConfig = async (field: string, value: string | number | boolean | string[] | Record<string, string>) => {
    setSaveStatus("saving");
    try {
      const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
        engineConfig: { [field]: value },
      }) as UserSettings;
      if (updated) setSettings(updated);
      showSaved();
    } catch {
      showError();
    }
  };

  const rp = settings?.riskProfile;
  const ec = settings?.engineConfig;
  const activeProfile = ec?.tradingProfile || "intraday";
  const riskTabLoading = activeTab === "risk" && !rp;
  const engineTabLoading = activeTab === "engine" && !ec;
  const engineTabLoadingLabel = "Loading engine configuration...";
  const riskTabLoadingLabel = "Loading risk profile...";
  const activeOverlayLabel = activeTab === "api"
    ? (apiTabLoading ? apiTabLoadingLabel : null)
    : activeTab === "risk"
      ? (riskTabLoading ? riskTabLoadingLabel : null)
      : activeTab === "engine"
        ? (engineTabLoading ? engineTabLoadingLabel : null)
        : null;
  const contentLoading = Boolean(activeOverlayLabel);

  const handleApiTabLoadingStateChange = useCallback((busy: boolean, label?: string) => {
    setApiTabLoading(busy);
    if (label) {
      setApiTabLoadingLabel(label);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== "engine" || !showAdvancedEngine || aiModels.length > 0) return;
    setModelsLoading(true);
    window.api.invoke(IPC.AI_LIST_MODELS)
      .then((data: { id: string; name: string }[]) => setAiModels(data))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, [activeTab, showAdvancedEngine, aiModels.length]);

  useEffect(() => {
    if (activeTab !== "engine" || !showAdvancedEngine || !ec) return;
    if (!profilePresetName.trim()) {
      setProfilePresetName(`${activeProfile} preset`);
    }

    setProfileActionState("loading");
    setProfileActionError(null);
    window.api.invoke(IPC.PROFILE_LIST, { profile: activeProfile })
      .then((data) => setProfileConfigs((data as ProfileConfigRecord[]) ?? []))
      .catch((err) => {
        setProfileActionError(err instanceof Error ? err.message : "Failed to load profile presets");
        setProfileConfigs([]);
      })
      .finally(() => setProfileActionState("idle"));
  }, [activeTab, showAdvancedEngine, ec, activeProfile]);

  const refreshProfileConfigs = async () => {
    if (!ec) return;
    setProfileActionState("loading");
    setProfileActionError(null);
    try {
      const data = await window.api.invoke(IPC.PROFILE_LIST, { profile: activeProfile });
      setProfileConfigs((data as ProfileConfigRecord[]) ?? []);
    } catch (err) {
      setProfileActionError(err instanceof Error ? err.message : "Failed to load profile presets");
    } finally {
      setProfileActionState("idle");
    }
  };

  const handleSaveProfileConfig = async () => {
    if (!ec) return;
    const name = profilePresetName.trim();
    if (!name) {
      setProfileActionError("Preset name is required");
      return;
    }

    setProfileActionState("saving");
    setProfileActionError(null);
    try {
      await window.api.invoke(IPC.PROFILE_SAVE, {
        name,
        profile: activeProfile,
        config: ec,
      });
      await refreshProfileConfigs();
      setProfilePresetName(name);
    } catch (err) {
      setProfileActionError(err instanceof Error ? err.message : "Failed to save preset");
    } finally {
      setProfileActionState("idle");
    }
  };

  const handleApplyProfileConfig = async (configId: string) => {
    setProfileActionState("applying");
    setProfileActionError(null);
    try {
      const updated = await window.api.invoke(IPC.PROFILE_APPLY, { id: configId }) as { settings: UserSettings };
      if (updated?.settings) {
        setSettings(updated.settings);
      }
      await refreshProfileConfigs();
    } catch (err) {
      setProfileActionError(err instanceof Error ? err.message : "Failed to apply preset");
    } finally {
      setProfileActionState("idle");
    }
  };

  const handleDeleteProfileConfig = async (configId: string) => {
    setProfileActionState("deleting");
    setProfileActionError(null);
    try {
      await window.api.invoke(IPC.PROFILE_DELETE, { id: configId });
      await refreshProfileConfigs();
    } catch (err) {
      setProfileActionError(err instanceof Error ? err.message : "Failed to delete preset");
    } finally {
      setProfileActionState("idle");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="750px" height="500px">
      <div className="flex flex-1 min-h-0 font-sans">
        {/* Left Sidebar */}
        <div className="w-[200px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] flex flex-col pt-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative w-full text-left flex items-center gap-3 px-4 py-3 text-[13px] font-medium transition-colors outline-none"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-overlay)" : "transparent",
                }}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-r-sm" />
                )}
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Content */}
        <div className={`relative flex-1 p-6 bg-transparent ${contentLoading ? "overflow-hidden" : "overflow-y-auto"}`}>
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  User Interface
                </h3>
                <button
                  disabled
                  className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: saveStatus === "saved" ? "var(--color-profit-bg)" : "var(--color-info-bg)",
                    color: saveStatus === "saved" ? "var(--color-profit)" : "var(--color-info)",
                    border: `1px solid ${saveStatus === "saved" ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
                  }}
                >
                  {saveStatus === "saving" ? (
                    <><Loader2 size={11} className="animate-spin" /> Saving...</>
                  ) : saveStatus === "saved" ? (
                    <><CheckCircle size={11} /> Saved</>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Theme Preference</p>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Toggle between dark and light modes</p>
                  </div>
                  <div className="flex items-center gap-2 p-1 bg-[var(--bg-inset)] rounded-lg border border-[var(--border)]">
                    <button
                      onClick={async () => {
                        if (theme !== "dark") {
                          toggleTheme();
                          setSaveStatus("saving");
                          try {
                            await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: "dark" });
                            showSaved();
                          } catch { showError(); }
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${theme === "dark" ? "bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                    >
                      Dark
                    </button>
                    <button
                      onClick={async () => {
                        if (theme !== "light") {
                          toggleTheme();
                          setSaveStatus("saving");
                          try {
                            await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: "light" });
                            showSaved();
                          } catch { showError(); }
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${theme === "light" ? "bg-[var(--bg-overlay)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                    >
                      Light
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <APIKeysTab onLoadingStateChange={handleApiTabLoadingStateChange} />
          )}

          {activeTab === "risk" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    Risk Profile
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1 max-w-[32rem]">
                    These controls define how aggressive the agent is allowed to be. Lower values make trading more conservative.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[11px] text-[var(--text-secondary)]">
                  {saveStatus === "saving" ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      Saving...
                    </>
                  ) : saveStatus === "saved" ? (
                    <>
                      <CheckCircle size={11} />
                      Saved
                    </>
                  ) : (
                    "Auto-save on"
                  )}
                </span>
              </div>
              {rp ? (
                <div className="space-y-4">
                  <SettingsSection
                    title="Position Size"
                    description="How much the agent can commit to a single idea and how much leverage it may use."
                  >
                    <SettingRow
                      label="Risk Per Trade"
                      description="Maximum percentage of account balance the agent may risk on one trade."
                    >
                      <SliderInput
                        value={rp.maxRiskPct}
                        min={0.1}
                        max={10}
                        step={0.1}
                        onChange={(v) => updateRiskProfile("maxRiskPct", v)}
                        formatValue={(v) => formatPercent(v, 1)}
                        minLabel="0.1%"
                        maxLabel="10.0%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Max Leverage"
                      description="Upper limit for leverage used by the engine."
                    >
                      <SliderInput
                        value={rp.maxLeverage}
                        min={1}
                        max={20}
                        step={1}
                        onChange={(v) => updateRiskProfile("maxLeverage", Math.round(v))}
                        formatValue={(v) => `${Math.round(v)}x`}
                        minLabel="1x"
                        maxLabel="20x"
                      />
                    </SettingRow>
                  </SettingsSection>

                  <SettingsSection
                    title="Account Protection"
                    description="Hard stop rules that prevent the agent from over-trading or digging a deeper loss."
                  >
                    <SettingRow
                      label="Daily Loss Stop"
                      description="Stop opening new trades after this percentage loss in one day."
                    >
                      <SliderInput
                        value={rp.maxDailyLossPct}
                        min={1}
                        max={20}
                        step={0.5}
                        onChange={(v) => updateRiskProfile("maxDailyLossPct", v)}
                        formatValue={(v) => formatPercent(v, 1)}
                        minLabel="1.0%"
                        maxLabel="20.0%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Max Open Positions"
                      description="Maximum number of trades the agent may keep open at once."
                    >
                      <SliderInput
                        value={rp.maxOpenPositions}
                        min={1}
                        max={20}
                        step={1}
                        onChange={(v) => updateRiskProfile("maxOpenPositions", Math.round(v))}
                        formatValue={(v) => `${Math.round(v)} trade${Math.round(v) === 1 ? "" : "s"}`}
                        minLabel="1"
                        maxLabel="20"
                      />
                    </SettingRow>
                  </SettingsSection>

                  <SettingsSection
                    title="Signal Quality"
                    description="How selective the agent should be before it is allowed to act on an AI decision."
                  >
                    <SettingRow
                      label="Minimum Confidence"
                      description="Higher values mean the agent will ignore weaker AI signals."
                    >
                      <SliderInput
                        value={rp.minConfidence}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateRiskProfile("minConfidence", v)}
                        formatValue={(v) => `${Math.round(v * 100)}%`}
                        minLabel="0%"
                        maxLabel="100%"
                      />
                    </SettingRow>
                  </SettingsSection>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">Loading risk profile...</p>
              )}
            </div>
          )}

          {activeTab === "engine" && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    Engine Configuration
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1 max-w-[32rem]">
                    Only the controls that change live trading behavior are shown here. Advanced AI model routing and internal analysis tuning now stay on system defaults.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[11px] text-[var(--text-secondary)]">
                  {saveStatus === "saving" ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      Saving...
                    </>
                  ) : saveStatus === "saved" ? (
                    <>
                      <CheckCircle size={11} />
                      Saved
                    </>
                  ) : (
                    "Auto-save on"
                  )}
                </span>
              </div>
              {ec ? (
                <div className="space-y-4">
                  <SettingsSection
                    title="Trading Style"
                    description={ec.autoPairSelection
                      ? "Choose how fast the engine trades. Pair choice is handled automatically across the broader live market."
                      : "Choose how fast the engine trades and which pair it should focus on."}
                  >
                    {!ec.autoPairSelection && (
                      <SettingRow
                        label="Trading Pair"
                        description="The single market pair the engine will trade."
                      >
                        <TextInput
                          value={ec.tradingSymbol}
                          onChange={(v) => updateEngineConfig("tradingSymbol", v.toUpperCase())}
                          className="w-40 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                        />
                      </SettingRow>
                    )}
                    <SettingRow
                      label="Trading Tempo"
                      description="Scalp reacts fastest, intraday is balanced, swing is slower and more selective."
                    >
                      <SegmentedControl
                        value={ec.tradingProfile}
                        options={["scalp", "intraday", "swing", "custom"]}
                        labels={{ scalp: "Fast", intraday: "Balanced", swing: "Selective", custom: "Custom" }}
                        onChange={(v) => updateEngineConfig("tradingProfile", v)}
                      />
                    </SettingRow>
                    <SettingRow
                      label="Analysis Timeframe"
                      description="Shorter candles react faster but create more noise."
                    >
                      <SegmentedControl
                        value={ec.candleTimeframe}
                        options={["1m", "5m", "15m"]}
                        labels={{ "1m": "1 min", "5m": "5 min", "15m": "15 min" }}
                        onChange={(v) => updateEngineConfig("candleTimeframe", v)}
                      />
                    </SettingRow>
                  </SettingsSection>

                  <SettingsSection
                    title="Automatic Pair Selection"
                    description="Automatic mode now scans a broader live USDT market universe and picks the strongest opportunities for you."
                  >
                    <SettingRow
                      label="Automatic Pair Selection"
                      description="Turn this on to let the engine discover and rotate into the strongest pairs automatically."
                    >
                      <Toggle checked={ec.autoPairSelection} onChange={(v) => updateEngineConfig("autoPairSelection", v)} />
                    </SettingRow>
                    {ec.autoPairSelection ? (
                      <>
                        <p className="pt-1 text-[11px] italic text-[var(--text-tertiary)]">
                          You do not need to choose a pair manually. If you ever want to restrict the engine to a custom shortlist, that option lives under Advanced Engine Controls.
                        </p>
                        <SettingRow
                          label="Max Active Pairs"
                          description="Maximum number of pairs the engine may keep open at the same time."
                        >
                          <SliderInput
                            value={ec.maxConcurrentSymbols}
                            min={1}
                            max={10}
                            step={1}
                            onChange={(v) => updateEngineConfig("maxConcurrentSymbols", Math.round(v))}
                            formatValue={(v) => `${Math.round(v)} pair${Math.round(v) === 1 ? "" : "s"}`}
                            minLabel="1 pair"
                            maxLabel="10 pairs"
                          />
                        </SettingRow>
                      </>
                    ) : (
                      <p className="pt-1 text-[11px] italic text-[var(--text-tertiary)]">
                        Single-pair mode is on. The engine will stay on your selected trading pair.
                      </p>
                    )}
                  </SettingsSection>

                  <SettingsSection
                    title="Automation Pace"
                    description="Set how often the engine checks the market and how quickly it is allowed to trade again."
                  >
                    <SettingRow
                      label="Market Check Frequency"
                      description="How often the engine scans the market and makes a fresh decision."
                    >
                      <SliderInput
                        value={ec.loopIntervalSec}
                        min={3}
                        max={120}
                        step={1}
                        onChange={(v) => updateEngineConfig("loopIntervalSec", Math.round(v))}
                        formatValue={formatSeconds}
                        minLabel="3 sec"
                        maxLabel="2 min"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Cooldown After Any Trade"
                      description="Minimum wait time before the next trade can open."
                    >
                      <SliderInput
                        value={ec.tradeCooldownSec}
                        min={0}
                        max={600}
                        step={5}
                        onChange={(v) => updateEngineConfig("tradeCooldownSec", Math.round(v))}
                        formatValue={formatSeconds}
                        minLabel="Off"
                        maxLabel="10 min"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Same-Pair Re-Entry Delay"
                      description="How long to wait before opening another trade on a pair that just closed."
                    >
                      <SliderInput
                        value={ec.symbolReentryCooldownSec}
                        min={0}
                        max={3600}
                        step={15}
                        onChange={(v) => updateEngineConfig("symbolReentryCooldownSec", Math.round(v))}
                        formatValue={formatSeconds}
                        minLabel="Off"
                        maxLabel="60 min"
                      />
                    </SettingRow>
                  </SettingsSection>

                  <SettingsSection
                    title="Safety Limits"
                    description="These are the main protection rails that decide when the engine should skip or pause trading."
                  >
                    <SettingRow
                      label="Max Order Slippage"
                      description="Skip entries if the expected fill drifts too far from the signal price."
                    >
                      <SliderInput
                        value={ec.maxSlippagePct}
                        min={0.01}
                        max={5}
                        step={0.01}
                        onChange={(v) => updateEngineConfig("maxSlippagePct", v)}
                        formatValue={(v) => formatPercent(v, 2)}
                        minLabel="0.01%"
                        maxLabel="5.00%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Drawdown Pause Level"
                      description="Pause the engine when account drawdown reaches this level."
                    >
                      <SliderInput
                        value={ec.maxDrawdownPct}
                        min={1}
                        max={50}
                        step={1}
                        onChange={(v) => updateEngineConfig("maxDrawdownPct", Math.round(v))}
                        formatValue={(v) => formatPercent(v)}
                        minLabel="1%"
                        maxLabel="50%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Volatility Ceiling"
                      description="Avoid entries when the market is moving too violently."
                    >
                      <SliderInput
                        value={ec.volatilityThresholdPct}
                        min={0.5}
                        max={20}
                        step={0.5}
                        onChange={(v) => updateEngineConfig("volatilityThresholdPct", v)}
                        formatValue={(v) => formatPercent(v, 1)}
                        minLabel="0.5%"
                        maxLabel="20.0%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Spread Ceiling"
                      description="Avoid entries when the bid/ask spread is too wide."
                    >
                      <SliderInput
                        value={ec.spreadThresholdPct}
                        min={0.01}
                        max={5}
                        step={0.01}
                        onChange={(v) => updateEngineConfig("spreadThresholdPct", v)}
                        formatValue={(v) => formatPercent(v, 2)}
                        minLabel="0.01%"
                        maxLabel="5.00%"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Loss Streak Pause"
                      description="Pause the engine after this many losing trades in a row."
                    >
                      <SliderInput
                        value={ec.maxConsecutiveLosses}
                        min={1}
                        max={20}
                        step={1}
                        onChange={(v) => updateEngineConfig("maxConsecutiveLosses", Math.round(v))}
                        formatValue={(v) => `${Math.round(v)} loss${Math.round(v) === 1 ? "" : "es"}`}
                        minLabel="1"
                        maxLabel="20"
                      />
                    </SettingRow>
                    <SettingRow
                      label="Use Trailing Stop"
                      description="Move the stop with the trade once price moves in your favor."
                    >
                      <Toggle checked={ec.enableTrailingStop} onChange={(v) => updateEngineConfig("enableTrailingStop", v)} />
                    </SettingRow>
                    {ec.enableTrailingStop && (
                      <SettingRow
                        label="Trailing Stop Distance"
                        description="How much room the trailing stop gives the market."
                      >
                        <SliderInput
                          value={ec.trailingStopPct}
                          min={0.1}
                          max={10}
                          step={0.1}
                          onChange={(v) => updateEngineConfig("trailingStopPct", v)}
                          formatValue={(v) => formatPercent(v, 1)}
                          minLabel="0.1%"
                          maxLabel="10.0%"
                        />
                      </SettingRow>
                    )}
                  </SettingsSection>

                  <SettingsSection
                    title="Extra Modes"
                    description="Optional modes for learning from closed trades or practicing without sending real orders."
                  >
                    <SettingRow
                      label="Review Closed Trades"
                      description="Let the app review completed trades and update local learning memory."
                    >
                      <Toggle checked={ec.reviewModeEnabled} onChange={(v) => updateEngineConfig("reviewModeEnabled", v)} />
                    </SettingRow>
                    <SettingRow
                      label="Practice Without Sending Orders"
                      description="Run the live decision engine but block all exchange orders."
                    >
                      <Toggle checked={ec.shadowModeEnabled} onChange={(v) => updateEngineConfig("shadowModeEnabled", v)} />
                    </SettingRow>
                    {settings?.selectedExchange === "paper" && (
                      <SettingRow
                        label="Paper Account Starting Balance"
                        description="Starting balance used for local paper trading."
                      >
                        <NumberInput
                          value={ec.paperStartingBalance}
                          min={100}
                          max={1000000}
                          step={100}
                          onChange={(v) => updateEngineConfig("paperStartingBalance", Math.round(v))}
                        />
                      </SettingRow>
                    )}
                  </SettingsSection>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Advanced Engine Controls</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 max-w-[30rem]">
                          Hidden by default because these controls tune the internal AI pipeline and scoring logic, not the everyday trading experience.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedEngine((prev) => !prev)}
                        className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-overlay)]"
                      >
                        {showAdvancedEngine ? "Hide Advanced" : "Show Advanced"}
                      </button>
                    </div>

                    {showAdvancedEngine && (
                      <div className="mt-3 space-y-4 border-t border-[var(--border)] pt-3">
                        <SettingsSection
                          title="Profile Presets"
                          description="Save a full engine setup and re-apply it later for this trading tempo."
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="px-2 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-inset)] text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                              {activeProfile}
                            </div>
                            {profileActionState === "loading" && (
                              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                                <Loader2 size={12} className="animate-spin" />
                                Loading presets...
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              type="text"
                              value={profilePresetName}
                              onChange={(e) => setProfilePresetName(e.target.value)}
                              placeholder={`${activeProfile} preset`}
                              className="flex-1 px-3 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                            />
                            <button
                              onClick={() => void handleSaveProfileConfig()}
                              disabled={profileActionState === "saving" || !ec}
                              className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: "var(--color-info-bg)",
                                color: "var(--color-info)",
                                border: "1px solid var(--color-info-border)",
                              }}
                            >
                              {profileActionState === "saving" ? "Saving..." : "Save Preset"}
                            </button>
                          </div>
                          {profileActionError && (
                            <p className="text-[11px] text-[var(--color-loss)] font-medium mb-2">
                              {profileActionError}
                            </p>
                          )}
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {profileConfigs.length > 0 ? (
                              profileConfigs.map((config) => (
                                <div key={config._id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2">
                                  <div>
                                    <p className="text-[12px] font-medium text-[var(--text-primary)]">{config.name}</p>
                                    <p className="text-[10px] text-[var(--text-tertiary)]">
                                      {new Date(config.updatedAt).toLocaleString()} · {config.profile}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => void handleApplyProfileConfig(config._id)}
                                      disabled={profileActionState === "applying" || profileActionState === "deleting" || profileActionState === "saving"}
                                      className="px-2.5 py-1 text-[10px] font-medium rounded-md border border-[var(--color-profit-border)] bg-[var(--color-profit-bg)] text-[var(--color-profit)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      Load
                                    </button>
                                    <button
                                      onClick={() => void handleDeleteProfileConfig(config._id)}
                                      disabled={profileActionState === "applying" || profileActionState === "deleting" || profileActionState === "saving"}
                                      className="px-2.5 py-1 text-[10px] font-medium rounded-md border border-[var(--color-loss-border)] bg-[var(--color-loss-bg)] text-[var(--color-loss)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-[11px] text-[var(--text-tertiary)] italic">No saved presets for this profile yet.</p>
                            )}
                          </div>
                        </SettingsSection>

                        <SettingsSection
                          title="AI Model Routing"
                          description="Control which models handle analysis, planning, execution review, and post-trade learning."
                        >
                          <SettingRow label="AI Retry Count" description="How many times to retry an AI step when it fails.">
                            <NumberInput value={ec.aiRetryCount} min={0} max={5} step={1} onChange={(v) => updateEngineConfig("aiRetryCount", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="Primary AI Model" description="Default model used for the trading decision pipeline.">
                            {modelsLoading ? (
                              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                                <Loader2 size={12} className="animate-spin" /> Loading models...
                              </span>
                            ) : (
                              <SelectInput
                                value={ec.aiModel}
                                options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.aiModel]}
                                onChange={(v) => updateEngineConfig("aiModel", v)}
                              />
                            )}
                          </SettingRow>
                          <SettingRow label="Market Analyst Model" description="Model used to judge market regime and no-trade conditions.">
                            <SelectInput
                              value={ec.stageModels.marketAnalyst}
                              options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.marketAnalyst]}
                              onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, marketAnalyst: v })}
                            />
                          </SettingRow>
                          <SettingRow label="Trade Architect Model" description="Model used to design entries, stops, and targets.">
                            <SelectInput
                              value={ec.stageModels.tradeArchitect}
                              options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.tradeArchitect]}
                              onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, tradeArchitect: v })}
                            />
                          </SettingRow>
                          <SettingRow label="Execution Critic Model" description="Model used for final approval or HOLD conversion.">
                            <SelectInput
                              value={ec.stageModels.executionCritic}
                              options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.executionCritic]}
                              onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, executionCritic: v })}
                            />
                          </SettingRow>
                          <SettingRow label="Post-Trade Reviewer Model" description="Model used for after-action review and learning memory updates.">
                            <SelectInput
                              value={ec.stageModels.postTradeReviewer}
                              options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.postTradeReviewer]}
                              onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, postTradeReviewer: v })}
                            />
                          </SettingRow>
                        </SettingsSection>

                        <SettingsSection
                          title="Selection And Memory Tuning"
                          description="Fine-tune how much trade history and local memory affect symbol ranking and AI context."
                        >
                          <SettingRow label="Restrict Auto Discovery To Shortlist" description="Only use this if you want to limit automatic discovery to a custom set of pairs.">
                            <Toggle
                              checked={ec.restrictAutoPairSelectionToShortlist}
                              onChange={(v) => updateEngineConfig("restrictAutoPairSelectionToShortlist", v)}
                            />
                          </SettingRow>
                          {ec.restrictAutoPairSelectionToShortlist && (
                            <SettingRow label="Auto Discovery Shortlist" description="Comma-separated pairs the engine is allowed to discover from when shortlist restriction is enabled.">
                              <TextInput
                                value={(ec.candidateSymbols ?? ec.watchlist ?? []).join(", ")}
                                onChange={(v) => updateEngineConfig("candidateSymbols", v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))}
                                className="w-[320px] px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                              />
                            </SettingRow>
                          )}
                          <SettingRow label="Memory Retrieval Count" description="Number of prior cases pulled into each AI cycle.">
                            <NumberInput value={ec.memoryRetrievalCount} min={1} max={20} step={1} onChange={(v) => updateEngineConfig("memoryRetrievalCount", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="Memory Lookback Days" description="How far back local AI memory search is allowed to go.">
                            <NumberInput value={ec.memoryLookbackDays} min={1} max={365} step={1} onChange={(v) => updateEngineConfig("memoryLookbackDays", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="Performance Lookback Days" description="Recent trade window used to score candidate pairs.">
                            <NumberInput value={ec.performanceLookbackDays} min={1} max={180} step={1} onChange={(v) => updateEngineConfig("performanceLookbackDays", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="Minimum Sample Size" description="Closed trades needed before a pair’s win rate is enforced.">
                            <NumberInput value={ec.minSymbolSampleSize} min={1} max={50} step={1} onChange={(v) => updateEngineConfig("minSymbolSampleSize", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="Minimum Pair Win Rate" description="Pairs below this win rate get suppressed once enough history exists.">
                            <NumberInput value={ec.minSymbolWinRate} min={0} max={1} step={0.05} onChange={(v) => updateEngineConfig("minSymbolWinRate", v)} />
                          </SettingRow>
                          <SettingRow label="Critique Strictness" description="How aggressively the execution critic downgrades ideas.">
                            <SelectInput value={ec.critiqueStrictness} options={["low", "balanced", "high"]} onChange={(v) => updateEngineConfig("critiqueStrictness", v)} />
                          </SettingRow>
                          <SettingRow label="Hold-Time Bias" description="Bias the system toward shorter or longer holding periods.">
                            <SelectInput value={ec.holdTimeBias} options={["shorter", "balanced", "longer"]} onChange={(v) => updateEngineConfig("holdTimeBias", v)} />
                          </SettingRow>
                          <SettingRow label="Exit Style Preference" description="Bias the system toward fixed, trailing, or hybrid exits.">
                            <SelectInput value={ec.exitStylePreference} options={["fixed", "trailing", "hybrid", "balanced"]} onChange={(v) => updateEngineConfig("exitStylePreference", v)} />
                          </SettingRow>
                        </SettingsSection>

                        <SettingsSection
                          title="Indicators And Reliability"
                          description="Low-level analysis inputs and fallback controls. Change these only if you know the impact."
                        >
                          <SettingRow label="Enable Multi-Model Voting" description="Use multiple AI models and combine their signals.">
                            <Toggle checked={ec.enableMultiModelVoting} onChange={(v) => updateEngineConfig("enableMultiModelVoting", v)} />
                          </SettingRow>
                          <SettingRow label="Voting Models" description="Comma-separated model IDs used when voting is enabled.">
                            <TextInput
                              value={(ec.votingModels ?? []).join(", ")}
                              onChange={(v) => updateEngineConfig("votingModels", v.split(",").map((s) => s.trim()).filter(Boolean))}
                              className="w-[320px] px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                            />
                          </SettingRow>
                          <SettingRow label="Websocket Reconnect Retries" description="Reconnect attempts before live streaming gives up.">
                            <NumberInput value={ec.wsReconnectRetries} min={1} max={20} step={1} onChange={(v) => updateEngineConfig("wsReconnectRetries", Math.round(v))} />
                          </SettingRow>
                          <SettingRow label="EMA Indicator" description="Include exponential moving averages in analysis.">
                            <Toggle checked={ec.enableEMA} onChange={(v) => updateEngineConfig("enableEMA", v)} />
                          </SettingRow>
                          <SettingRow label="Bollinger Bands" description="Include Bollinger Band ranges in analysis.">
                            <Toggle checked={ec.enableBollingerBands} onChange={(v) => updateEngineConfig("enableBollingerBands", v)} />
                          </SettingRow>
                          <SettingRow label="ADX Indicator" description="Include ADX trend-strength analysis.">
                            <Toggle checked={ec.enableADX} onChange={(v) => updateEngineConfig("enableADX", v)} />
                          </SettingRow>
                          <SettingRow label="ATR Indicator" description="Include ATR volatility analysis.">
                            <Toggle checked={ec.enableATR} onChange={(v) => updateEngineConfig("enableATR", v)} />
                          </SettingRow>
                          <SettingRow label="Stochastic Indicator" description="Include stochastic momentum analysis.">
                            <Toggle checked={ec.enableStochastic} onChange={(v) => updateEngineConfig("enableStochastic", v)} />
                          </SettingRow>
                        </SettingsSection>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                  <p className="text-[12px] text-[var(--text-tertiary)] italic">Loading engine config...</p>
                )}
            </div>
          )}

          {activeOverlayLabel && <SettingsTabLoadingOverlay label={activeOverlayLabel} />}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[var(--color-warn)] animate-pulse" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[var(--color-profit)]">
              <CheckCircle size={11} />
              Auto-saved
            </span>
          )}
          {saveStatus === "idle" && (
            <span>Changes save automatically</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="px-5 py-1.5 text-[12px] font-medium text-[var(--text-inverse)] bg-[var(--text-primary)] rounded hover:opacity-90 transition-opacity"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
