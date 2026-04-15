import React from "react";
import { clsx } from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div className={clsx("glass p-4", className)}>
      {children}
    </div>
  );
}
