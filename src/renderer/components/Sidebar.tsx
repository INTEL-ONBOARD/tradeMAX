import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { SettingsModal } from "./SettingsModal";
import { Zap, LayoutGrid, Settings, Shield } from "./icons";

interface RibbonProps {
  activeView: string;
  onChangeView: (view: string) => void;
}

export function SidebarRibbon({ activeView, onChangeView }: RibbonProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const agentStatus = useAppStore((s) => s.agentStatus);

  const navItems = [
    { id: "agent", icon: Zap },
    { id: "tools", icon: LayoutGrid },
  ];

  return (
    <>
      <aside
        className="flex flex-col items-center py-4 h-full shrink-0 border-r border-[var(--border)] z-10 relative"
        style={{ width: "var(--sidebar-width)", background: "var(--bg-topbar, var(--bg-surface))" }}
      >
        {/* Nav actions */}
        <div className="flex-1 flex flex-col items-center gap-6 mt-4">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${isActive
                  ? "text-primary-400 bg-primary-500/10"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
                  }`}
              >
                {isActive && (
                  <div className="absolute left-[-16px] w-[3px] h-6 bg-primary-500 rounded-r-md" />
                )}
                <item.icon size={20} />
              </button>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-4 mb-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
          >
            <Settings size={20} />
          </button>

          {/* Agent status badge */}
          <div className="relative mt-2">
            <Shield size={24} className={agentStatus.running ? "text-[var(--color-profit)]" : agentStatus.frozen ? "text-[var(--color-loss)]" : "text-[var(--text-tertiary)]"} />
            <div className={`absolute bottom-0 right-[-2px] w-2.5 h-2.5 rounded-full border border-[var(--bg-surface)] ${agentStatus.running ? "bg-[var(--color-profit)]" : agentStatus.frozen ? "bg-[var(--color-loss)]" : "bg-transparent"
              }`} />
          </div>
        </div>
      </aside>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
