import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { ArrowRight, TrendingUp } from "../components/icons";

export function IntroPage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  const goAuth = (mode: "login" | "register") => {
    setAuthMode(mode);
    setScreen("auth");
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden grid-bg"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #3B82F6 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 px-6 text-center">
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.5)]"
        >
          <TrendingUp size={30} className="text-white" />
        </motion.div>

        {/* Wordmark */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <h1 className="text-5xl font-extrabold tracking-tight text-[var(--text-primary)] leading-none">
            Trade<span className="text-primary-400">MAX</span>
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
            Autonomous AI-powered crypto trading agent with hard safety controls
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {["Claude AI Decisions", "Risk Engine", "Safety Guardrails", "Live Streaming"].map((f) => (
            <span
              key={f}
              className="px-3 py-1.5 rounded-full text-xs font-medium border"
              style={{
                background: "var(--color-info-bg)",
                borderColor: "var(--color-info-border)",
                color: "var(--color-info)"
              }}
            >
              {f}
            </span>
          ))}
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex gap-3 w-full max-w-xs"
        >
          <button
            onClick={() => goAuth("login")}
            className="btn-primary flex-1 py-3"
          >
            Sign In <ArrowRight size={15} />
          </button>
          <button
            onClick={() => goAuth("register")}
            className="btn-ghost flex-1 py-3"
          >
            Create Account
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="text-[11px] text-[var(--text-tertiary)] max-w-xs"
        >
          All trading activity is subject to your configured risk profile and safety limits
        </motion.p>
      </div>
    </div>
  );
}
