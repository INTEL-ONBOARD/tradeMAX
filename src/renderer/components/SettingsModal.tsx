import { useState } from "react";
import { Modal } from "./Modal";
import { APIKeysPanel } from "./APIKeysPanel";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Settings, Shield, Edit3, Monitor } from "./icons";
import type { UserSettings } from "../../shared/types";

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
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= min && v <= max) onChange(v);
      }}
      className="w-24 px-2 py-1.5 text-[12px] text-right rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
    />
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
      className="w-24 px-2 py-1.5 text-[12px] rounded-md border border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-primary)] outline-none focus:border-[var(--primary-500)] transition-colors"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
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

  const updateRiskProfile = async (field: string, value: number) => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
      riskProfile: { [field]: value },
    }) as UserSettings;
    if (updated) setSettings(updated);
  };

  const updateEngineConfig = async (field: string, value: string | number | boolean) => {
    const updated = await window.api.invoke(IPC.SETTINGS_UPDATE, {
      engineConfig: { [field]: value },
    }) as UserSettings;
    if (updated) setSettings(updated);
  };

  const rp = settings?.riskProfile;
  const ec = settings?.engineConfig;

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
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                User Interface
              </h3>

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
                          await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: "dark" });
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
                          await window.api.invoke(IPC.SETTINGS_UPDATE, { themePreference: "light" });
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
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
                <Shield size={14} className="text-[var(--text-tertiary)]" />
                API Key Management
              </h3>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Securely store your exchange API keys. They are encrypted locally and never leave your machine.
              </p>
              <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
                <APIKeysPanel />
              </div>
            </div>
          )}

          {activeTab === "risk" && (
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                Risk Engine Parameters
              </h3>
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
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
                Engine Configuration
              </h3>
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
                    <TextInput value={ec.aiModel} onChange={(v) => updateEngineConfig("aiModel", v)} />
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
        <button
          className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Recommended
        </button>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] bg-transparent border border-[var(--border-strong)] rounded hover:bg-[var(--bg-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-[12px] font-medium text-[var(--text-inverse)] bg-[var(--text-primary)] rounded hover:opacity-90 transition-opacity"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
