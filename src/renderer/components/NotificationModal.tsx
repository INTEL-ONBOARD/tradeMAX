import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { X, AlertTriangle, Activity, Bot, Shield } from "./icons";
import type { AppNotification } from "../../shared/types.js";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<AppNotification["type"], { icon: typeof Activity; label: string; color: string }> = {
  trade:  { icon: Activity,      label: "Trade",  color: "var(--color-profit)" },
  risk:   { icon: AlertTriangle, label: "Risk",   color: "var(--color-loss)" },
  system: { icon: Shield,        label: "System", color: "var(--color-warn)" },
  ai:     { icon: Bot,           label: "AI",     color: "var(--color-info)" },
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const clearNotifications = useAppStore((s) => s.clearNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />

          {/* Panel — slides in from right, anchored to sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl shadow-2xl"
            style={{
              left: "calc(var(--sidebar-width) + 8px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: "360px",
              maxHeight: "520px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0"
              style={{ background: "var(--bg-elevated)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--color-loss)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[var(--color-loss)] rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-overlay)] transition-colors"
                    >
                      Mark all read
                    </button>
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--color-loss)] px-2 py-1 rounded-md hover:bg-[var(--bg-overlay)] transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-[var(--border)] flex items-center justify-center">
                    <Shield size={20} className="text-[var(--text-tertiary)]" />
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    No notifications yet
                  </span>
                </div>
              ) : (
                notifications.map((notif) => {
                  const cfg = typeConfig[notif.type];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`w-full text-left px-4 py-3 flex gap-3 border-b border-[var(--border)] hover:bg-[var(--bg-overlay)] transition-colors ${
                        !notif.read ? "bg-[var(--bg-elevated)]" : ""
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                        }}
                      >
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {notif.title}
                          </span>
                          {!notif.read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-loss)] shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                          {timeAgo(notif.timestamp)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
