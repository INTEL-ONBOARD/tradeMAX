import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/appStore";
import type { UserSession, UserSettings } from "../../shared/types";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";

type AuthStep = "login" | "register";

export function AuthPage() {
  const [currentStep, setCurrentStep] = useState<AuthStep>("login");
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setScreen = useAppStore((s) => s.setScreen);

  const handleSuccess = (session: UserSession, settings: UserSettings) => {
    setUser(session);
    setSettings(settings);
    if (settings.themePreference) {
      setTheme(settings.themePreference);
    }
    setScreen("dashboard");
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center grid-bg"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient glow - larger and more prominent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-[0.1] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #EF4444 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center w-full px-6">
        <AnimatePresence mode="wait">
          {currentStep === "login" && (
            <LoginForm
              onRegisterClick={() => setCurrentStep("register")}
              onSuccess={handleSuccess}
            />
          )}

          {currentStep === "register" && (
            <RegisterForm
              onLoginClick={() => setCurrentStep("login")}
              onSuccess={handleSuccess}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
