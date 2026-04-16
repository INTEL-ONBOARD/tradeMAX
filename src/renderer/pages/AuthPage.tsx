import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/appStore";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { TrendingUp, Mail, Lock, User, ArrowLeft, AlertCircle, Loader2 } from "../components/icons";

function InputField({
  icon: Icon, type = "text", placeholder, value, onChange, required, minLength, autoComplete,
}: {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border transition-all px-3.5 py-3 ${
        focused
          ? "border-[var(--border-focus)] shadow-[0_0_0_3px_rgba(59,130,246,0.1)] bg-[var(--bg-inset)]"
          : "border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-strong)]"
      }`}
    >
      <Icon size={16} className={`shrink-0 transition-colors ${focused ? "text-primary-400" : "text-[var(--text-tertiary)]"}`} />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
      />
    </div>
  );
}

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
      if (result.settings.themePreference) setTheme(result.settings.themePreference);
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
    <div
      className="h-screen w-screen flex items-center justify-center grid-bg"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full opacity-[0.07] blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #3B82F6 0%, transparent 70%)" }}
      />

      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.34, 1.1, 0.64, 1] }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="card-elevated p-8">
          {/* Logo + Back */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shadow-[0_2px_8px_rgba(59,130,246,0.4)]">
                <TrendingUp size={13} className="text-white" />
              </div>
              <span className="font-bold text-sm text-[var(--text-primary)]">TradeMAX</span>
            </div>
            <button
              onClick={() => setScreen("intro")}
              className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <ArrowLeft size={13} /> Back
            </button>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] leading-tight">
              {isRegister ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {isRegister ? "Set up TradeMAX to start autonomous trading" : "Sign in to your TradeMAX dashboard"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {isRegister && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <InputField
                  icon={User}
                  placeholder="Full name"
                  value={name}
                  onChange={setName}
                  required
                  autoComplete="name"
                />
              </motion.div>
            )}

            <InputField
              icon={Mail}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={setEmail}
              required
              autoComplete="email"
            />

            <InputField
              icon={Lock}
              type="password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              required
              minLength={8}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-lg p-3 border border-[var(--color-loss-border)] bg-[var(--color-loss-bg)]"
              >
                <AlertCircle size={14} className="text-[var(--color-loss)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-loss)] leading-relaxed">{error}</p>
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-1"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> {isRegister ? "Creating account..." : "Signing in..."}</>
              ) : (
                isRegister ? "Create Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Switch */}
          <p className="text-center text-xs text-[var(--text-tertiary)] mt-5">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => { setAuthMode(isRegister ? "login" : "register"); setError(""); }}
              className="text-primary-400 font-medium hover:text-primary-300 transition-colors"
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
