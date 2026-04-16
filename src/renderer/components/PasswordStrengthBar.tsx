import { motion } from "framer-motion";
import { calculatePasswordStrength } from "./PasswordStrengthUtils";

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { score, level, message } = calculatePasswordStrength(password);

  // Color mapping based on strength level
  const colorMap: Record<string, { gradient: string; color: string }> = {
    weak:   { gradient: "linear-gradient(90deg, #F43F5E, #F97316)", color: "#F43F5E" },
    fair:   { gradient: "linear-gradient(90deg, #F97316, #EAB308)", color: "#F97316" },
    good:   { gradient: "linear-gradient(90deg, #EAB308, #10B981)", color: "#EAB308" },
    strong: { gradient: "linear-gradient(90deg, #10B981, #34D399)", color: "#10B981" },
  };

  const { gradient, color } = colorMap[level];

  // Ensure the bar shows at least a visible width for any non-zero score
  const barWidth = score > 0 ? Math.max(score, 8) : 0;

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: gradient }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Strength label */}
      <motion.p
        className="text-xs font-medium"
        style={{ color }}
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
