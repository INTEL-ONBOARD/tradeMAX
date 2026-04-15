import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";

export function APIKeysPanel() {
  const settings = useAppStore((s) => s.settings);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !apiSecret || !settings) return;
    await window.api.invoke(IPC.SETTINGS_SAVE_API_KEYS, {
      exchange: settings.selectedExchange,
      apiKey,
      apiSecret,
    });
    setApiKey("");
    setApiSecret("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
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
        onClick={handleSave}
        disabled={!apiKey || !apiSecret}
        className="w-full py-1.5 text-xs rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 disabled:opacity-30 transition-colors"
      >
        {saved ? "Saved!" : "Save Keys"}
      </button>
    </div>
  );
}
