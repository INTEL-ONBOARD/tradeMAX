import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/appStore";
import type { UserSession, UserSettings } from "../../shared/types";
import { ChoiceScreen } from "../components/ChoiceScreen";
import { LoginForm } from "../components/LoginForm";
import { RegisterForm } from "../components/RegisterForm";

type AuthStep = "choice" | "login" | "register";

export function AuthPage() {
  const [currentStep, setCurrentStep] = useState<AuthStep>("choice");
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setScreen = useAppStore((s) => s.setScreen);

  // Ambient glow effect
  useEffect(() => {
    // Any initialization if needed
  }, []);

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
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full opacity-[0.07] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #EF4444 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center w-full px-6">
        <AnimatePresence mode="wait">
          {currentStep === "choice" && (
            <ChoiceScreen
              onLoginSelect={() => setCurrentStep("login")}
              onRegisterSelect={() => setCurrentStep("register")}
            />
          )}

          {currentStep === "login" && (
            <LoginForm
              onBack={() => setCurrentStep("choice")}
              onSuccess={handleSuccess}
            />
          )}

          {currentStep === "register" && (
            <RegisterForm
              onBack={() => setCurrentStep("choice")}
              onSuccess={handleSuccess}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
