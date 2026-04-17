import { useState, useRef, useCallback, useEffect } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Settings, Shield, Edit3, Monitor, CheckCircle, Loader2 } from "./icons";
import type { UserSettings } from "../../shared/types";

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

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      className="w-40 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
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

function PasswordInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <input
      type="password"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-48 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
    />
  );
}

function SaveButton({ onClick, disabled, saved, label }: { onClick: () => void; disabled: boolean; saved: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: saved ? "var(--color-profit-bg)" : "var(--color-info-bg)",
        color: saved ? "var(--color-profit)" : "var(--color-info)",
        border: `1px solid ${saved ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
      }}
    >
      {saved ? (
        <span className="flex items-center gap-1"><CheckCircle size={11} /> Saved</span>
      ) : (
        label
      )}
    </button>
  );
}

function ExchangeKeyRow({ exchange }: { exchange: "bybit" }) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const setPortfolio = useAppStore((s) => s.setPortfolio);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasKeys = settings?.hasBybitKeys;

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
      setApiKey(""); setApiSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.message ?? "Validation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingRow label="API Key" description={`Your ${exchange} API key`}>
        <div className="flex items-center gap-2">
          {hasKeys && !apiKey && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-profit)] font-medium">
              <CheckCircle size={10} /> Active
            </span>
          )}
          <PasswordInput value={apiKey} placeholder={hasKeys ? "••••••••••••" : "Enter API key"} onChange={(v) => { setApiKey(v); setError(null); }} />
        </div>
      </SettingRow>
      <SettingRow label="API Secret" description={`Your ${exchange} API secret`}>
        <div className="flex items-center gap-2">
          <PasswordInput value={apiSecret} placeholder={hasKeys ? "••••••••••••" : "Enter API secret"} onChange={(v) => { setApiSecret(v); setError(null); }} />
          <button
            onClick={handleSave}
            disabled={!apiKey || !apiSecret || saving}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: saved ? "var(--color-profit-bg)" : "var(--color-info-bg)",
              color: saved ? "var(--color-profit)" : "var(--color-info)",
              border: `1px solid ${saved ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
            }}
          >
            {saving ? (
              <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Validating...</span>
            ) : saved ? (
              <span className="flex items-center gap-1"><CheckCircle size={11} /> Validated</span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </SettingRow>
      {error && (
        <div className="px-1 py-2">
          <p className="text-[11px] text-[var(--color-loss)] font-medium">{error}</p>
        </div>
      )}
    </>
  );
}

function APIKeysTab() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [claudeKey, setClaudeKey] = useState("");
  const [savedClaude, setSavedClaude] = useState(false);
  const [savingClaude, setSavingClaude] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);

  const handleSaveClaude = async () => {
    if (!claudeKey) return;
    setSavingClaude(true);
    setClaudeError(null);
    try {
      const updated = await window.api.invoke(IPC.SETTINGS_SAVE_CLAUDE_KEY, { claudeApiKey: claudeKey });
      setSettings(updated as UserSettings);
      setClaudeKey("");
      setSavedClaude(true);
      setTimeout(() => setSavedClaude(false), 2500);
    } catch (err: any) {
      setClaudeError(err?.message ?? "Validation failed");
    } finally {
      setSavingClaude(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Claude AI Key */}
      <div>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Claude AI Key
          </h3>
          <button
            onClick={handleSaveClaude}
            disabled={!claudeKey || savingClaude}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: savedClaude ? "var(--color-profit-bg)" : "var(--color-info-bg)",
              color: savedClaude ? "var(--color-profit)" : "var(--color-info)",
              border: `1px solid ${savedClaude ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
            }}
          >
            {savingClaude ? (
              <><Loader2 size={11} className="animate-spin" /> Validating...</>
            ) : savedClaude ? (
              <><CheckCircle size={11} /> Validated</>
            ) : (
              "Save"
            )}
          </button>
        </div>
        <SettingRow
          label="Anthropic API Key"
          description={settings?.hasClaudeKey ? "Key is active and encrypted locally" : "Required for AI-powered trade analysis"}
        >
          <div className="flex items-center gap-2">
            {settings?.hasClaudeKey && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-profit)] font-medium">
                <CheckCircle size={10} /> Active
              </span>
            )}
            <PasswordInput
              value={claudeKey}
              placeholder={settings?.hasClaudeKey ? "••••••••••••" : "sk-ant-..."}
              onChange={(v) => { setClaudeKey(v); setClaudeError(null); }}
            />
          </div>
        </SettingRow>
        {claudeError && (
          <div className="px-1 py-2">
            <p className="text-[11px] text-[var(--color-loss)] font-medium">{claudeError}</p>
          </div>
        )}
      </div>

      {/* Bybit */}
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Bybit API Keys
        </h3>
        <ExchangeKeyRow exchange="bybit" />
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

  const updateEngineConfig = async (field: string, value: string | number | boolean) => {
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

  const [aiModels, setAiModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "engine" || aiModels.length > 0) return;
    setModelsLoading(true);
    (window as any).api.invoke(IPC.AI_LIST_MODELS)
      .then((data: { id: string; name: string }[]) => setAiModels(data))
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, [activeTab]);

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
        <div className="flex-1 overflow-y-auto p-6 bg-transparent">
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

          {activeTab === "api" && <APIKeysTab />}

          {activeTab === "risk" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Risk Engine Parameters
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
              {rp ? (
                <div>
                  <SettingRow label="Max Risk Per Trade %" description="Maximum percentage of balance risked per trade (0.1 - 10)">
                    <NumberInput value={rp.maxRiskPct} min={0.1} max={10} step={0.1} onChange={(v) => updateRiskProfile("maxRiskPct", v)} />
                  </SettingRow>
                  <SettingRow label="Max Daily Loss %" description="Stop trading after this daily loss threshold (1 - 20)">
                    <NumberInput value={rp.maxDailyLossPct} min={1} max={20} step={0.5} onChange={(v) => updateRiskProfile("maxDailyLossPct", v)} />
                  </SettingRow>
                  <SettingRow label="Max Open Positions" description="Maximum concurrent open positions (1 - 20)">
                    <NumberInput value={rp.maxOpenPositions} min={1} max={20} step={1} onChange={(v) => updateRiskProfile("maxOpenPositions", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Min AI Confidence" description="Minimum AI confidence score to execute (0 - 1)">
                    <NumberInput value={rp.minConfidence} min={0} max={1} step={0.05} onChange={(v) => updateRiskProfile("minConfidence", v)} />
                  </SettingRow>
                  <SettingRow label="Max Leverage" description="Maximum leverage multiplier (1 - 125)">
                    <NumberInput value={rp.maxLeverage} min={1} max={125} step={1} onChange={(v) => updateRiskProfile("maxLeverage", Math.round(v))} />
                  </SettingRow>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">Loading risk profile...</p>
              )}
            </div>
          )}

          {activeTab === "engine" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Engine Configuration
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
              {ec ? (
                <div>
                  <SettingRow label="Trading Symbol" description="The trading pair symbol (e.g. BTCUSDT)">
                    <TextInput value={ec.tradingSymbol} onChange={(v) => updateEngineConfig("tradingSymbol", v)} />
                  </SettingRow>
                  <SettingRow label="Loop Interval (sec)" description="Seconds between each trading loop iteration (3 - 120)">
                    <NumberInput value={ec.loopIntervalSec} min={3} max={120} step={1} onChange={(v) => updateEngineConfig("loopIntervalSec", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Candle Timeframe" description="Candlestick timeframe for analysis">
                    <SelectInput value={ec.candleTimeframe} options={["1m", "5m", "15m"]} onChange={(v) => updateEngineConfig("candleTimeframe", v)} />
                  </SettingRow>
                  <SettingRow label="Max Slippage %" description="Maximum allowed slippage on orders (0.01 - 5)">
                    <NumberInput value={ec.maxSlippagePct} min={0.01} max={5} step={0.01} onChange={(v) => updateEngineConfig("maxSlippagePct", v)} />
                  </SettingRow>
                  <SettingRow label="Trade Cooldown (sec)" description="Minimum seconds between consecutive trades (0 - 600)">
                    <NumberInput value={ec.tradeCooldownSec} min={0} max={600} step={5} onChange={(v) => updateEngineConfig("tradeCooldownSec", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="AI Retry Count" description="Number of retries on AI analysis failure (0 - 5)">
                    <NumberInput value={ec.aiRetryCount} min={0} max={5} step={1} onChange={(v) => updateEngineConfig("aiRetryCount", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="AI Model" description="AI model identifier for trade analysis">
                    {modelsLoading ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                        <Loader2 size={12} className="animate-spin" /> Loading models...
                      </span>
                    ) : (
                      <SelectInput
                        value={ec.aiModel}
                        options={aiModels.length > 0
                          ? aiModels.map((m) => m.id)
                          : [ec.aiModel]
                        }
                        onChange={(v) => updateEngineConfig("aiModel", v)}
                      />
                    )}
                  </SettingRow>
                  <SettingRow label="Max Consecutive Losses" description="Freeze after this many consecutive losing trades (1 - 20)">
                    <NumberInput value={ec.maxConsecutiveLosses} min={1} max={20} step={1} onChange={(v) => updateEngineConfig("maxConsecutiveLosses", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Max Drawdown %" description="Maximum portfolio drawdown before freeze (1 - 50)">
                    <NumberInput value={ec.maxDrawdownPct} min={1} max={50} step={1} onChange={(v) => updateEngineConfig("maxDrawdownPct", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Volatility Threshold %" description="Skip trades when volatility exceeds this (0.5 - 20)">
                    <NumberInput value={ec.volatilityThresholdPct} min={0.5} max={20} step={0.5} onChange={(v) => updateEngineConfig("volatilityThresholdPct", v)} />
                  </SettingRow>
                  <SettingRow label="Spread Threshold %" description="Skip trades when spread exceeds this (0.01 - 5)">
                    <NumberInput value={ec.spreadThresholdPct} min={0.01} max={5} step={0.01} onChange={(v) => updateEngineConfig("spreadThresholdPct", v)} />
                  </SettingRow>
                  <SettingRow label="WS Reconnect Retries" description="WebSocket reconnection attempts before giving up (1 - 20)">
                    <NumberInput value={ec.wsReconnectRetries} min={1} max={20} step={1} onChange={(v) => updateEngineConfig("wsReconnectRetries", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Enable EMA" description="Include EMA indicator in AI analysis">
                    <Toggle checked={ec.enableEMA} onChange={(v) => updateEngineConfig("enableEMA", v)} />
                  </SettingRow>
                  <SettingRow label="Enable Bollinger Bands" description="Include Bollinger Bands indicator in AI analysis">
                    <Toggle checked={ec.enableBollingerBands} onChange={(v) => updateEngineConfig("enableBollingerBands", v)} />
                  </SettingRow>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--text-tertiary)] italic">Loading engine config...</p>
              )}
            </div>
          )}
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
