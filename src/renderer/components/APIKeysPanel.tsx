import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { UserSettings } from "../../shared/types";

export function APIKeysPanel() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [savedExchange, setSavedExchange] = useState(false);

  const [claudeKey, setClaudeKey] = useState("");
  const [savedClaude, setSavedClaude] = useState(false);

  const handleSaveExchange = async () => {
    if (!apiKey || !apiSecret || !settings) return;
    await window.api.invoke(IPC.SETTINGS_SAVE_API_KEYS, {
      exchange: settings.selectedExchange,
      apiKey,
      apiSecret,
    });
    setApiKey("");
    setApiSecret("");
    setSavedExchange(true);
    setTimeout(() => setSavedExchange(false), 2000);
  };

  const handleSaveClaude = async () => {
    if (!claudeKey) return;
    const updated = await window.api.invoke(IPC.SETTINGS_SAVE_CLAUDE_KEY, {
      claudeApiKey: claudeKey,
    });
    setSettings(updated as UserSettings);
    setClaudeKey("");
    setSavedClaude(true);
    setTimeout(() => setSavedClaude(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Claude API Key */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Claude API Key</span>
          {settings?.hasClaudeKey && (
            <span className="text-[10px] text-green-400">configured</span>
          )}
        </div>
        <input
          type="password"
          placeholder={settings?.hasClaudeKey ? "••••••••••" : "sk-ant-..."}
          value={claudeKey}
          onChange={(e) => setClaudeKey(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSaveClaude}
          disabled={!claudeKey}
          className="w-full py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-30 transition-colors"
        >
          {savedClaude ? "Saved!" : "Save Claude Key"}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Exchange API Keys */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-secondary)]">
          {settings?.selectedExchange?.toUpperCase()} API Keys
        </span>
        <input
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
        />
        <input
          type="password"
          placeholder="API Secret"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSaveExchange}
          disabled={!apiKey || !apiSecret}
          className="w-full py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-30 transition-colors"
        >
          {savedExchange ? "Saved!" : "Save Exchange Keys"}
        </button>
      </div>
    </div>
  );
}
