import { useState } from "react";
import { motion } from "framer-motion";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { Mail, Lock, ArrowLeft, AlertCircle, Loader2, User } from "./icons";
import { InputField } from "./InputField";
import { validateEmail, validatePassword } from "./PasswordStrengthUtils";

interface LoginFormProps {
  onBack: () => void;
  onSuccess: (session: UserSession, settings: UserSettings) => void;
}

export function LoginForm({ onBack, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({
    email: null,
    password: null,
  });
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {
      email: validateEmail(email),
      password: validatePassword(password, 1), // Login just needs non-empty
    };
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => e === null);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setDirtyFields((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({
      ...prev,
      email: validateEmail(value),
    }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setDirtyFields((prev) => ({ ...prev, password: true }));
    setErrors((prev) => ({
      ...prev,
      password: validatePassword(value, 1),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = (await (window as any).api.invoke(IPC.AUTH_LOGIN, {
        email,
        password,
      })) as {
        session: UserSession;
        settings: UserSettings;
      };
      onSuccess(result.session, result.settings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("INVALID_CREDENTIALS")) {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      // OAuth would be implemented here
      setError("Google OAuth not yet implemented");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="login-form"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[420px]"
    >
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
          Welcome back
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Sign in to your TradeMAX dashboard
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-2 p-3 rounded-lg border border-[var(--color-loss-border)] bg-[var(--color-loss-bg)]"
        >
          <AlertCircle size={14} className="text-[var(--color-loss)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-loss)]">{error}</p>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          icon={Mail}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={handleEmailChange}
          error={errors.email}
          isDirty={dirtyFields.email}
          autoComplete="email"
        />

        <InputField
          icon={Lock}
          type="password"
          placeholder="Password"
          value={password}
          onChange={handlePasswordChange}
          error={errors.password}
          isDirty={dirtyFields.password}
          autoComplete="current-password"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || Object.values(errors).some((e) => e !== null)}
          className="btn-primary w-full py-3 mt-6"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-[var(--bg-base)] text-[var(--text-tertiary)]">
            OR
          </span>
        </div>
      </div>

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        className="btn-ghost w-full py-3 flex items-center justify-center gap-2"
      >
        <User size={14} /> Continue with Google
      </button>
    </motion.div>
  );
}
