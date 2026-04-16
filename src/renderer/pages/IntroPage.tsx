import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { TrendingUp, ArrowRight } from "../components/icons";

export function IntroPage() {
  const setScreen = useAppStore((s) => s.setScreen);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  return (
    <div
      className="h-screen w-screen flex items-center justify-center overflow-hidden relative"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Drag region */}
      <div
        className="absolute top-0 left-0 right-0 h-10 w-full z-50 pointer-events-none"
        style={{ WebkitAppRegion: "drag", opacity: 0 } as React.CSSProperties}
      />

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.08] blur-[120px] orb-1"
          style={{ background: "var(--color-loss)" }}
        />
        <div
          className="absolute top-[20%] right-[15%] w-[350px] h-[350px] rounded-full opacity-[0.05] blur-[100px] orb-2"
          style={{ background: "#6366F1" }}
        />
        <div
          className="absolute bottom-[20%] left-[20%] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px] orb-3"
          style={{ background: "var(--color-profit)" }}
        />
      </div>

      {/* Grid */}
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-md px-6"
      >
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl gradient-red flex items-center justify-center logo-glow mb-6">
          <TrendingUp size={28} className="text-white" />
        </div>

        {/* Brand */}
        <h1 className="text-5xl font-extrabold tracking-tight text-[var(--text-primary)] mb-3">
          trade<span className="text-[var(--color-loss)]">MAX</span>
        </h1>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-10 max-w-xs">
          AI-powered autonomous crypto trading.
          <br />
          Secure. Fast. Intelligent.
        </p>

        {/* CTA buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <motion.button
            onClick={() => {
              setAuthMode("register");
              setScreen("auth");
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-xl gradient-red text-white font-semibold text-sm flex items-center justify-center gap-2 cta-glow"
          >
            Get Started
            <ArrowRight size={14} />
          </motion.button>

          <motion.button
            onClick={() => {
              setAuthMode("login");
              setScreen("auth");
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium text-sm transition-colors"
            style={{ background: "var(--bg-elevated)" }}
          >
            I already have an account
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
