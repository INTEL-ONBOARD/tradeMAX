import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/appStore";
import type { UserSession, UserSettings } from "../../shared/types";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";

type AuthStep = "login" | "register";

export function AuthPage() {
  const authMode = useAppStore((s) => s.authMode);
  const [currentStep, setCurrentStep] = useState<AuthStep>(authMode);
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setScreen = useAppStore((s) => s.setScreen);

  const handleSuccess = (session: UserSession, settings: UserSettings) => {
    setUser(session);
    setSettings(settings);
    // Only apply server theme if user has explicitly saved a preference before;
    // otherwise keep the current theme (light by default)
    const savedPref = localStorage.getItem("theme-preference");
    if (savedPref) {
      setTheme(savedPref as "dark" | "light");
    }
    setScreen("dashboard");
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ background: "var(--bg-surface)" }}>
      {/* Drag region */}
      <div
        className="absolute top-0 left-0 right-0 h-10 w-full z-50 pointer-events-none"
        style={{ WebkitAppRegion: "drag", opacity: 0 } as React.CSSProperties}
      />

      {/* ─── Left Panel: Hero Card ─── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden md:flex w-[46%] h-full p-4 pr-2"
      >
        <div className="relative w-full h-full rounded-3xl overflow-hidden">
          {/* Gradient base */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#DC2626] via-[#991B1B] to-[#1a0a2e]" />

          {/* Animated wave blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full opacity-40 blur-[60px] hero-wave-1"
              style={{ background: "linear-gradient(135deg, #EF4444, #F97316)" }}
            />
            <div
              className="absolute bottom-[5%] right-[10%] w-[400px] h-[400px] rounded-full opacity-30 blur-[70px] hero-wave-2"
              style={{ background: "linear-gradient(135deg, #7C3AED, #EC4899)" }}
            />
            <div
              className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-25 blur-[50px] hero-wave-3"
              style={{ background: "linear-gradient(135deg, #F43F5E, #FB923C)" }}
            />
          </div>

          {/* Content overlay */}
          <div className="relative z-10 flex flex-col justify-between h-full p-10">
            {/* Top spacer */}
            <div />

            {/* Center — Hero copy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-5">
                Autonomous Trading
              </p>
              <h1 className="text-[32px] font-extrabold text-white leading-[1.15] tracking-tight">
                Trade smarter with
                <br />
                AI-powered
                <br />
                automation
              </h1>
            </motion.div>

            {/* Bottom — Trust text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-white/30 text-[10px] font-medium uppercase tracking-[0.2em]"
            >
              Secure &middot; Fast &middot; Intelligent
            </motion.p>
          </div>
        </div>
      </motion.div>

      {/* ─── Right Panel: Form ─── */}
      <div className="flex-1 h-full flex items-center justify-center relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-[380px] px-8"
        >
          <AnimatePresence mode="wait">
            {currentStep === "login" && (
              <LoginForm
                key="login"
                onRegisterClick={() => setCurrentStep("register")}
                onSuccess={handleSuccess}
              />
            )}

            {currentStep === "register" && (
              <RegisterForm
                key="register"
                onLoginClick={() => setCurrentStep("login")}
                onSuccess={handleSuccess}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
