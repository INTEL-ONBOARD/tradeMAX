import { motion } from "framer-motion";
import { calculatePasswordStrength } from "./PasswordStrengthUtils";

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { score, level, message } = calculatePasswordStrength(password);

  // Color mapping based on strength level
  const colorMap = {
    weak: { bar: "bg-gradient-to-r from-[var(--color-loss)] to-orange-500", text: "text-[var(--color-loss)]" },
    fair: { bar: "bg-gradient-to-r from-orange-500 to-yellow-500", text: "text-orange-500" },
    good: { bar: "bg-gradient-to-r from-yellow-500 to-[var(--color-profit)]", text: "text-yellow-500" },
    strong: { bar: "bg-gradient-to-r from-[var(--color-profit)] to-green-400", text: "text-[var(--color-profit)]" },
  };

  const { bar, text } = colorMap[level];

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Strength label */}
      <motion.p
        className={`text-xs font-500 ${text}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {message}
      </motion.p>

      {/* Helper text */}
      {level === "weak" && (
        <motion.p
          className="text-xs text-[var(--text-tertiary)]"
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          Add numbers and symbols for a stronger password
        </motion.p>
      )}
    </div>
  );
}
