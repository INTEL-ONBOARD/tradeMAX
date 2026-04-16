import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { TrendingUp } from "../components/icons";

export function IntroPage() {
  const setScreen = useAppStore((s) => s.setScreen);

  const metricsData = [
    { label: "Today's Profit", value: "+$8,240", trend: "up" as const, subtext: "↑ 12% from yesterday" },
    { label: "Win Rate", value: "87%", trend: "up" as const, subtext: "124 trades this week" },
    { label: "Active Positions", value: "3", trend: "neutral" as const, subtext: "BTC, ETH, SOL" },
    { label: "Avg Monthly Return", value: "18.5%", trend: "up" as const, subtext: "Risk-adjusted performance" },
  ];

  return (
    <div
      className="h-screen w-screen flex items-center justify-center overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Animated gradient background */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, #EF4444 0%, transparent 70%)",
          animation: "gradientShift 15s ease infinite",
        }}
      />

      <div className="relative z-10 max-w-2xl w-full px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(239,68,68,0.5)]"
          >
            <TrendingUp size={30} className="text-white" />
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] mb-2"
          >
            Trade<span className="text-primary-500">MAX</span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-lg text-[var(--text-secondary)] max-w-md mx-auto"
          >
            Autonomous AI-powered crypto trading agent with hard safety controls
          </motion.p>
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12"
        >
          {metricsData.map((metric, idx) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + idx * 0.05, duration: 0.5 }}
              className="glass-card glass-card-dark p-4"
            >
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                {metric.label}
              </p>
              <p className="text-3xl font-bold text-primary-500 mb-1">
                {metric.value}
              </p>
              {metric.subtext && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {metric.subtext}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {["Claude AI Decisions", "Risk Engine", "Safety Controls", "24/7 Trading"].map((feature) => (
            <span
              key={feature}
              className="glass-badge text-[var(--text-secondary)]"
            >
              {feature}
            </span>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center"
        >
          <button
            onClick={() => setScreen("auth")}
            className="btn-primary px-8 py-3 text-lg font-600 hover:scale-105 active:scale-95 transition-transform"
          >
            Get Started
          </button>
        </motion.div>
      </div>
    </div>
  );
}
