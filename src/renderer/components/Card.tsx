import React from "react";
import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "surface" | "elevated" | "inset";
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm:   "p-3",
  md:   "p-4",
  lg:   "p-6",
};

export function Card({ children, className, variant = "surface", padding = "md" }: CardProps) {
  return (
    <div
      className={clsx(
        variant === "elevated" ? "card-elevated" : "card",
        variant === "inset" && "bg-[var(--bg-inset)] border-[var(--border)]",
        paddingMap[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
