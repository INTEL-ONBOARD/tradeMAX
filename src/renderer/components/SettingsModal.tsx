import { useState, useRef, useCallback, useEffect } from "react";
import { Modal } from "./Modal";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Settings, Shield, Edit3, Monitor, CheckCircle, Loader2 } from "./icons";
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
  const setPortfolio = useAppStore((s) => s.setPortfolio);
  const setPositions = useAppStore((s) => s.setPositions);
  const setExchangeHistory = useAppStore((s) => s.setExchangeHistory);
  const agentRunning = useAppStore((s) => s.agentStatus.running);

  const [openaiKey, setOpenaiKey] = useState("");
  const [savedOpenAI, setSavedOpenAI] = useState(false);
  const [savingOpenAI, setSavingOpenAI] = useState(false);
  const [openaiError, setOpenaiError] = useState<string | null>(null);
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
      setOpenaiKey("");
      setSavedOpenAI(true);
      setTimeout(() => setSavedOpenAI(false), 2500);
    } catch (err: any) {
      setOpenaiError(err?.message ?? "Validation failed");
    } finally {
      setSavingOpenAI(false);
    }
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
          <button
            onClick={handleSaveOpenAI}
            disabled={!openaiKey || savingOpenAI}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: savedOpenAI ? "var(--color-profit-bg)" : "var(--color-info-bg)",
              color: savedOpenAI ? "var(--color-profit)" : "var(--color-info)",
              border: `1px solid ${savedOpenAI ? "var(--color-profit-border)" : "var(--color-info-border)"}`,
            }}
          >
            {savingOpenAI ? (
              <><Loader2 size={11} className="animate-spin" /> Validating...</>
            ) : savedOpenAI ? (
              <><CheckCircle size={11} /> Validated</>
            ) : (
              "Save"
            )}
          </button>
        </div>
        <SettingRow
          label="OpenAI API Key"
          description={settings?.hasOpenAIKey ? "Key is active and encrypted locally" : "Required for GPT-powered trade analysis"}
        >
          <div className="flex items-center gap-2">
            {settings?.hasOpenAIKey && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-profit)] font-medium">
                <CheckCircle size={10} /> Active
              </span>
            )}
            <PasswordInput
              value={openaiKey}
              placeholder={settings?.hasOpenAIKey ? "••••••••••••" : "sk-proj-..."}
              onChange={(v) => { setOpenaiKey(v); setOpenaiError(null); }}
            />
          </div>
        </SettingRow>
        {openaiError && (
          <div className="px-1 py-2">
            <p className="text-[11px] text-[var(--color-loss)] font-medium">{openaiError}</p>
          </div>
        )}
      </div>

      {/* Bybit */}
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Bybit API Keys
        </h3>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
          Required only when Bybit is selected as the active execution venue.
        </p>
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
  const [profileConfigs, setProfileConfigs] = useState<ProfileConfigRecord[]>([]);
  const [profilePresetName, setProfilePresetName] = useState("");
  const [profileActionState, setProfileActionState] = useState<"idle" | "loading" | "saving" | "applying" | "deleting">("idle");
  const [profileActionError, setProfileActionError] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab !== "engine" || !ec) return;
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
  }, [activeTab, activeProfile, settings?.selectedExchange, settings?.engineConfig?.tradingProfile]);

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
                  <SettingRow label="Max Leverage" description="Maximum leverage multiplier (1 - 20)">
                    <NumberInput value={rp.maxLeverage} min={1} max={20} step={1} onChange={(v) => updateRiskProfile("maxLeverage", Math.round(v))} />
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
                  <SettingRow label="Active Tempo Profile" description="One active profile per running agent instance">
                    <SelectInput value={ec.tradingProfile} options={["scalp", "intraday", "swing", "custom"]} onChange={(v) => updateEngineConfig("tradingProfile", v)} />
                  </SettingRow>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">Profile Presets</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                          Save the current engine configuration and reload it later for this tempo profile.
                        </p>
                      </div>
                      <div className="px-2 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-inset)] text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                        {activeProfile}
                      </div>
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
                      {profileActionState === "loading" ? (
                        <p className="text-[11px] text-[var(--text-tertiary)] italic">Loading saved presets...</p>
                      ) : profileConfigs.length > 0 ? (
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
                  </div>
                  <SettingRow label="Auto Pair Selection" description="Pick the strongest pair from your watchlist before the agent starts trading">
                    <Toggle checked={ec.autoPairSelection} onChange={(v) => updateEngineConfig("autoPairSelection", v)} />
                  </SettingRow>
                  <SettingRow label="Auto Pair Watchlist" description="Comma-separated symbols scanned when auto pair selection is enabled">
                    <TextInput
                      value={(ec.watchlist ?? []).join(", ")}
                      onChange={(v) => updateEngineConfig("watchlist", v.split(",").map((s) => s.trim()).filter(Boolean))}
                      className="w-64 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
                    />
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
                  <SettingRow label="Market Analyst Model" description="Stage-specific model for regime and no-trade assessment">
                    <SelectInput
                      value={ec.stageModels.marketAnalyst}
                      options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.marketAnalyst]}
                      onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, marketAnalyst: v } as any)}
                    />
                  </SettingRow>
                  <SettingRow label="Trade Architect Model" description="Stage-specific model for trade design and sizing">
                    <SelectInput
                      value={ec.stageModels.tradeArchitect}
                      options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.tradeArchitect]}
                      onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, tradeArchitect: v } as any)}
                    />
                  </SettingRow>
                  <SettingRow label="Execution Critic Model" description="Stage-specific model for approval or HOLD conversion">
                    <SelectInput
                      value={ec.stageModels.executionCritic}
                      options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.executionCritic]}
                      onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, executionCritic: v } as any)}
                    />
                  </SettingRow>
                  <SettingRow label="Reviewer Model" description="Stage-specific model for post-trade review memory">
                    <SelectInput
                      value={ec.stageModels.postTradeReviewer}
                      options={aiModels.length > 0 ? aiModels.map((m) => m.id) : [ec.stageModels.postTradeReviewer]}
                      onChange={(v) => updateEngineConfig("stageModels", { ...ec.stageModels, postTradeReviewer: v } as any)}
                    />
                  </SettingRow>
                  <SettingRow label="Memory Retrieval Count" description="How many local cases to retrieve into each cycle">
                    <NumberInput value={ec.memoryRetrievalCount} min={1} max={20} step={1} onChange={(v) => updateEngineConfig("memoryRetrievalCount", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Memory Lookback Days" description="How far back local memory retrieval searches">
                    <NumberInput value={ec.memoryLookbackDays} min={1} max={365} step={1} onChange={(v) => updateEngineConfig("memoryLookbackDays", Math.round(v))} />
                  </SettingRow>
                  <SettingRow label="Critique Strictness" description="How aggressively the execution critic downgrades trades">
                    <SelectInput value={ec.critiqueStrictness} options={["low", "balanced", "high"]} onChange={(v) => updateEngineConfig("critiqueStrictness", v)} />
                  </SettingRow>
                  <SettingRow label="Hold-Time Bias" description="Bias the agent toward shorter or longer trade duration">
                    <SelectInput value={ec.holdTimeBias} options={["shorter", "balanced", "longer"]} onChange={(v) => updateEngineConfig("holdTimeBias", v)} />
                  </SettingRow>
                  <SettingRow label="Exit Style Preference" description="Bias the architect toward fixed, trailing, or hybrid exits">
                    <SelectInput value={ec.exitStylePreference} options={["fixed", "trailing", "hybrid", "balanced"]} onChange={(v) => updateEngineConfig("exitStylePreference", v)} />
                  </SettingRow>
                  <SettingRow label="Review Mode" description="Run the post-trade reviewer and idle self-review to update local memory">
                    <Toggle checked={ec.reviewModeEnabled} onChange={(v) => updateEngineConfig("reviewModeEnabled", v)} />
                  </SettingRow>
                  <SettingRow label="Shadow Mode" description="Run the full staged pipeline live without sending orders">
                    <Toggle checked={ec.shadowModeEnabled} onChange={(v) => updateEngineConfig("shadowModeEnabled", v)} />
                  </SettingRow>
                  <SettingRow label="Enable Multi-Model Voting" description="Use multiple AI models and aggregate their signals">
                    <Toggle checked={ec.enableMultiModelVoting} onChange={(v) => updateEngineConfig("enableMultiModelVoting", v)} />
                  </SettingRow>
                  <SettingRow label="Voting Models" description="Comma-separated list of model IDs for voting">
                    <TextInput
                      value={(ec.votingModels ?? []).join(", ")}
                      onChange={(v) => updateEngineConfig("votingModels", v.split(",").map((s) => s.trim()).filter(Boolean))}
                    />
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
                  <SettingRow label="Enable ADX" description="Include ADX trend-strength analysis">
                    <Toggle checked={ec.enableADX} onChange={(v) => updateEngineConfig("enableADX", v)} />
                  </SettingRow>
                  <SettingRow label="Enable ATR" description="Include ATR volatility analysis">
                    <Toggle checked={ec.enableATR} onChange={(v) => updateEngineConfig("enableATR", v)} />
                  </SettingRow>
                  <SettingRow label="Enable Stochastic" description="Include stochastic momentum analysis">
                    <Toggle checked={ec.enableStochastic} onChange={(v) => updateEngineConfig("enableStochastic", v)} />
                  </SettingRow>
                  <SettingRow label="Enable Trailing Stop" description="Raise or lower stop levels as the market moves in your favor">
                    <Toggle checked={ec.enableTrailingStop} onChange={(v) => updateEngineConfig("enableTrailingStop", v)} />
                  </SettingRow>
                  <SettingRow label="Trailing Stop %" description="Trailing stop distance used when trailing stops are enabled (0.1 - 10)">
                    <NumberInput value={ec.trailingStopPct} min={0.1} max={10} step={0.1} onChange={(v) => updateEngineConfig("trailingStopPct", v)} />
                  </SettingRow>
                  <SettingRow label="Paper Starting Balance" description="Starting account balance for local paper trading (100 - 1,000,000)">
                    <NumberInput value={ec.paperStartingBalance} min={100} max={1000000} step={100} onChange={(v) => updateEngineConfig("paperStartingBalance", Math.round(v))} />
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
