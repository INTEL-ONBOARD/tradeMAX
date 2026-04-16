import { useState } from "react";
import { motion } from "framer-motion";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { Mail, Lock, User, AlertCircle, Loader2, Chrome } from "./icons";
import { InputField } from "./InputField";
import { PasswordStrengthBar } from "./PasswordStrengthBar";
import { validateEmail, validatePassword, validateName } from "./PasswordStrengthUtils";

interface RegisterFormProps {
  onLoginClick: () => void;
  onSuccess: (session: UserSession, settings: UserSettings) => void;
}

export function RegisterForm({ onLoginClick, onSuccess }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({
    name: null,
    email: null,
    password: null,
  });
  const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isFormValid =
    name.trim().length >= 2 &&
    validateEmail(email) === null &&
    validatePassword(password, 8) === null &&
    Object.values(errors).every((e) => e === null);

  const handleNameChange = (value: string) => {
    setName(value);
    setDirtyFields((prev) => ({ ...prev, name: true }));
    setErrors((prev) => ({
      ...prev,
      name: validateName(value),
    }));
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
      password: validatePassword(value, 8),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isFormValid) return;

    setLoading(true);
    try {
      const result = (await (window as any).api.invoke(IPC.AUTH_REGISTER, {
        name,
        email,
        password,
      })) as {
        session: UserSession;
        settings: UserSettings;
      };
      onSuccess(result.session, result.settings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("EMAIL_EXISTS")) {
        setError("An account with this email already exists.");
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
      setError("Google OAuth not yet implemented");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="register-form"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-[420px]"
    >

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
          Create account
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Set up TradeMAX to start autonomous trading
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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <InputField
            icon={User}
            placeholder="Full name"
            value={name}
            onChange={handleNameChange}
            error={errors.name}
            isDirty={dirtyFields.name}
            autoComplete="name"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <InputField
            icon={Lock}
            type="password"
            placeholder="Password"
            value={password}
            onChange={handlePasswordChange}
            error={errors.password}
            isDirty={dirtyFields.password}
            autoComplete="new-password"
          />
          {dirtyFields.password && (
            <PasswordStrengthBar password={password} />
          )}
        </motion.div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={loading || !isFormValid}
          className="btn-primary w-full py-3 mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          whileHover={!loading ? { scale: 1.02 } : {}}
          whileTap={!loading ? { scale: 0.98 } : {}}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </motion.button>
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
      <motion.button
        type="button"
        onClick={handleGoogleAuth}
        disabled={loading}
        className="btn-ghost w-full py-3 flex items-center justify-center gap-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        whileHover={!loading ? { scale: 1.02 } : {}}
        whileTap={!loading ? { scale: 0.98 } : {}}
      >
        <Chrome size={14} /> Continue with Google
      </motion.button>

      {/* Login Link */}
      <motion.p
        className="text-sm text-[var(--text-secondary)] text-center mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        Already have an account?{" "}
        <button
          type="button"
          onClick={onLoginClick}
          className="text-primary-600 hover:text-primary-500 font-600 transition-colors hover:underline"
        >
          Login
        </button>
      </motion.p>
    </motion.div>
  );
}
