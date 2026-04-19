import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { SettingsModal } from "./SettingsModal";
import { NotificationModal } from "./NotificationModal";
import { IPC } from "../../shared/constants";
import { Zap, LayoutGrid, Settings, Bell, LogOut } from "./icons";

interface RibbonProps {
  activeView: string;
  onChangeView: (view: string) => void;
}

export function SidebarRibbon({ activeView, onChangeView }: RibbonProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unreadCount = useAppStore((s) => s.notifications.filter((n) => !n.read).length);
  const reset = useAppStore((s) => s.reset);

  const navItems = [
    { id: "agent", icon: Zap },
    { id: "tools", icon: LayoutGrid },
  ];

  const handleLogout = async () => {
    try {
      await window.api.invoke(IPC.AUTH_LOGOUT);
    } catch {
      // Even if main-process cleanup fails, clear the renderer session so the user is not stuck.
    } finally {
      reset();
    }
  };

  return (
    <>
      <aside
        className="flex flex-col items-center py-4 h-full shrink-0 border-r border-[var(--border)] z-10 relative"
        style={{ width: "var(--sidebar-width)", background: "var(--bg-topbar, var(--bg-surface))" }}
      >
        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-4 mb-2">
          {/* Nav actions first */}
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${isActive
                  ? "text-[var(--color-loss)] bg-[var(--color-loss)]/10"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
                  }`}
              >
                {isActive && (
                  <div className="absolute left-[-16px] w-[3px] h-6 bg-[var(--color-loss)] rounded-r-md" />
                )}
                <item.icon size={20} />
              </button>
            );
          })}

          {/* Notifications */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[var(--color-loss)] text-white text-[9px] font-bold px-1 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
          >
            <Settings size={20} />
          </button>

          {/* Divider */}
          <div className="w-6 h-px bg-[var(--border)]" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--color-loss)] hover:bg-[var(--color-loss)]/10 transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NotificationModal isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  );
}
