import { motion } from "framer-motion";
import React from "react";

interface SplitScreenLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  leftClassName?: string;
  rightClassName?: string;
}

export function SplitScreenLayout({
  leftContent,
  rightContent,
  leftClassName = "",
  rightClassName = "",
}: SplitScreenLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full min-h-screen">
      {/* Left Side */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className={`space-y-6 px-6 lg:px-0 ${leftClassName}`}
      >
        {leftContent}
      </motion.div>

      {/* Right Side */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={`px-6 lg:px-0 ${rightClassName}`}
      >
        {rightContent}
      </motion.div>
    </div>
  );
}
