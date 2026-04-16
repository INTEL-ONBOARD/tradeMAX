import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle, X } from "./icons";

export type ToastType = "error" | "success";

interface AuthToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onDismiss: () => void;
}

export function AuthToast({ message, type, visible, onDismiss }: AuthToastProps) {
  // Auto-dismiss after 4s
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  const isError = type === "error";

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/20"
            onClick={onDismiss}
          />

          {/* Toast */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="pointer-events-auto w-full max-w-sm rounded-xl p-5 border flex flex-col items-center gap-3 text-center shadow-lg"
              style={{
                background: "var(--bg-surface)",
                borderColor: isError ? "var(--color-loss-border)" : "var(--color-profit-border)",
              }}
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{
                  background: isError ? "var(--color-loss-bg)" : "var(--color-profit-bg)",
                }}
              >
                {isError ? (
                  <AlertCircle size={20} style={{ color: "var(--color-loss)" }} />
                ) : (
                  <CheckCircle size={20} style={{ color: "var(--color-profit)" }} />
                )}
              </div>

              {/* Title */}
              <p
                className="text-sm font-semibold"
                style={{ color: isError ? "var(--color-loss)" : "var(--color-profit)" }}
              >
                {isError ? "Something went wrong" : "Success"}
              </p>

              {/* Message */}
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {message}
              </p>

              {/* Dismiss */}
              <button
                onClick={onDismiss}
                className="mt-1 text-[10px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
              >
                <X size={10} />
                Dismiss
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
