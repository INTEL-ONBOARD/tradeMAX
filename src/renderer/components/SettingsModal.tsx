import { useState } from "react";
import { Modal } from "./Modal";
import { APIKeysPanel } from "./APIKeysPanel";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import { Settings, Shield, Edit3, Monitor } from "./icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" width="750px" height="500px">
      <div className="flex h-full font-sans">
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
              <p className="text-[12px] text-[var(--text-tertiary)] italic">
                (This space is reserved for Advanced Risk Tuning UI)
              </p>
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
