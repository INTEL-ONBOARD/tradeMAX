import { motion } from "framer-motion";

interface MetricsData {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  subtext?: string;
}

interface PerformanceMetricsProps {
  title?: string;
  metrics: MetricsData[];
  containerClassName?: string;
}

export function PerformanceMetrics({
  title,
  metrics,
  containerClassName = "",
}: PerformanceMetricsProps) {
  return (
    <motion.div
      className={`space-y-4 ${containerClassName}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {title && (
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          {title}
        </h3>
      )}

      <div className="space-y-3">
        {metrics.map((metric, idx) => (
          <motion.div
            key={`${metric.label}-${idx}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className="glass-card glass-card-dark p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--text-secondary)]">
                {metric.label}
              </span>
              {metric.trend && (
                <span
                  className="text-xs font-600"
                  style={{
                    color: metric.trend === "up" ? "var(--trend-up)" : metric.trend === "down" ? "var(--trend-down)" : "var(--trend-neutral)"
                  }}
                >
                  {metric.trend === "up" ? "↑" : metric.trend === "down" ? "↓" : "→"}
                </span>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.1 + 0.2, duration: 0.4 }}
            >
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {metric.value}
              </p>
              {metric.subtext && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {metric.subtext}
                </p>
              )}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
