import { motion } from "framer-motion";
import { User, Lock } from "./icons";

interface ChoiceScreenProps {
  onLoginSelect: () => void;
  onRegisterSelect: () => void;
}

export function ChoiceScreen({ onLoginSelect, onRegisterSelect }: ChoiceScreenProps) {
  return (
    <motion.div
      key="choice-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-12"
    >
      {/* Heading */}
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          TradeMAX
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Autonomous AI-powered crypto trading with hard safety controls
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-6">
        {/* Sign In Card */}
        <motion.button
          onClick={onLoginSelect}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          whileHover={{ y: -4, borderColor: "var(--border-focus)" }}
          className="glass p-8 md:p-12 rounded-2xl border border-[var(--glass-border)] text-left transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center mb-4">
            <Lock size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Sign In
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Access your existing TradeMAX account and dashboard
          </p>
          <div className="inline-flex items-center gap-2 text-primary-600 font-500 text-sm">
            Continue →
          </div>
        </motion.button>

        {/* Create Account Card */}
        <motion.button
          onClick={onRegisterSelect}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -4, borderColor: "var(--border-focus)" }}
          className="glass p-8 md:p-12 rounded-2xl border border-[var(--glass-border)] text-left transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center mb-4">
            <User size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Create Account
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Set up a new TradeMAX account and start trading with AI
          </p>
          <div className="inline-flex items-center gap-2 text-primary-600 font-500 text-sm">
            Get Started →
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
