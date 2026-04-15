import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { GlassCard } from "../components/GlassCard";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";

export function AuthPage() {
  const authMode = useAppStore((s) => s.authMode);
  const setAuthMode = useAppStore((s) => s.setAuthMode);
  const setScreen = useAppStore((s) => s.setScreen);
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = authMode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const channel = isRegister ? IPC.AUTH_REGISTER : IPC.AUTH_LOGIN;
      const payload = isRegister ? { name, email, password } : { email, password };

      const result = (await window.api.invoke(channel, payload)) as {
        session: UserSession;
        settings: UserSettings;
      };

      setUser(result.session);
      setSettings(result.settings);
      if (result.settings.themePreference) {
        setTheme(result.settings.themePreference);
      }
      setScreen("dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("EMAIL_EXISTS")) setError("An account with this email already exists.");
      else if (msg.includes("INVALID_CREDENTIALS")) setError("Invalid email or password.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <GlassCard className="w-[400px] p-8">
          <h2 className="text-2xl font-bold text-center mb-1">
            {isRegister ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
            {isRegister ? "Set up your TradeMAX account" : "Sign in to your account"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isRegister && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-primary"
            />

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : isRegister ? "Register" : "Login"}
            </button>
          </form>

          <p className="text-sm text-center mt-4 text-[var(--text-secondary)]">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setAuthMode(isRegister ? "login" : "register")}
              className="text-primary hover:underline"
            >
              {isRegister ? "Login" : "Register"}
            </button>
          </p>

          <button
            onClick={() => setScreen("intro")}
            className="block mx-auto mt-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Back
          </button>
        </GlassCard>
      </motion.div>
    </div>
  );
}
