import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { UserSettings } from "../../shared/types";
import { CheckCircle, Key, Bot, ChevronDown, ChevronUp } from "./icons";

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-overlay)] transition-colors"
      >
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <Icon size={13} />
          <span className="text-xs font-medium">{title}</span>
        </div>
        {open ? <ChevronUp size={13} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={13} className="text-[var(--text-tertiary)]" />}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="px-3 pb-3 space-y-2 border-t border-[var(--border)]"
        >
          <div className="pt-3">{children}</div>
        </motion.div>
      )}
    </div>
  );
}

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
      exchange: settings.selectedExchange, apiKey, apiSecret,
    });
    setApiKey(""); setApiSecret("");
    setSavedExchange(true);
    setTimeout(() => setSavedExchange(false), 2500);
  };

  const handleSaveClaude = async () => {
    if (!claudeKey) return;
    const updated = await window.api.invoke(IPC.SETTINGS_SAVE_CLAUDE_KEY, { claudeApiKey: claudeKey });
    setSettings(updated as UserSettings);
    setClaudeKey("");
    setSavedClaude(true);
    setTimeout(() => setSavedClaude(false), 2500);
  };

  return (
    <div className="space-y-3">
      <Section title="Claude AI Key" icon={Bot}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[var(--text-tertiary)]">Anthropic API Key</span>
          {settings?.hasClaudeKey && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-profit)]">
              <CheckCircle size={10} /> Active
            </span>
          )}
        </div>
        <input
          type="password"
          placeholder={settings?.hasClaudeKey ? "••••••••••••••••" : "sk-ant-..."}
          value={claudeKey}
          onChange={(e) => setClaudeKey(e.target.value)}
          className="input-base mb-2"
        />
        <button
          onClick={handleSaveClaude}
          disabled={!claudeKey}
          className="btn-primary w-full py-2 text-xs"
        >
          {savedClaude ? <><CheckCircle size={13} /> Saved</> : "Save Claude Key"}
        </button>
      </Section>

      <Section title={`${settings?.selectedExchange?.toUpperCase() ?? "Exchange"} API Keys`} icon={Key} defaultOpen={false}>
        <input
          type="password"
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input-base mb-2"
        />
        <input
          type="password"
          placeholder="API Secret"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          className="input-base mb-2"
        />
        <button
          onClick={handleSaveExchange}
          disabled={!apiKey || !apiSecret}
          className="btn-primary w-full py-2 text-xs"
        >
          {savedExchange ? <><CheckCircle size={13} /> Saved</> : "Save Exchange Keys"}
        </button>
      </Section>
    </div>
  );
}
