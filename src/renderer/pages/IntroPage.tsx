import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";

export function IntroPage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  const goAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setScreen("auth");
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-8 bg-[var(--bg-primary)]">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-6xl font-bold text-primary tracking-tight">
          Trade<span className="text-accent">MAX</span>
        </h1>
        <p className="mt-3 text-[var(--text-secondary)] text-lg">
          Autonomous Crypto Trading Agent
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex gap-4"
      >
        <button
          onClick={() => goAuth("login")}
          className="px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
        >
          Login
        </button>
        <button
          onClick={() => goAuth("register")}
          className="px-8 py-3 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/10 transition-colors"
        >
          Register
        </button>
      </motion.div>
    </div>
  );
}
