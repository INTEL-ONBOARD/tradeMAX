import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { Mail, Lock, User, Loader2, ArrowRight } from "./icons";
import { InputField } from "./InputField";
import { PasswordStrengthBar } from "./PasswordStrengthBar";
import { validateEmail, validatePassword, validateName } from "./PasswordStrengthUtils";
import { AuthToast, type ToastType } from "./AuthToast";

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
  const [loading, setLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: "",
    type: "error",
    visible: false,
  });
  const dismissToast = useCallback(() => setToast((t) => ({ ...t, visible: false })), []);
  const showToast = (message: string, type: ToastType = "error") =>
    setToast({ message, type, visible: true });

  const isFormValid =
    name.trim().length >= 2 &&
    validateEmail(email) === null &&
    validatePassword(password, 8) === null &&
    Object.values(errors).every((e) => e === null);

  const handleNameChange = (value: string) => {
    setName(value);
    setDirtyFields((prev) => ({ ...prev, name: true }));
    setErrors((prev) => ({ ...prev, name: validateName(value) }));
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setDirtyFields((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setDirtyFields((prev) => ({ ...prev, password: true }));
    setErrors((prev) => ({ ...prev, password: validatePassword(value, 8) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        showToast("An account with this email already exists.");
      } else {
        showToast(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Toast overlay */}
      <AuthToast {...toast} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Get Started
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">
          Create your account to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Name
          </label>
          <InputField
            icon={User}
            placeholder="Your full name"
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
          transition={{ delay: 0.1 }}
        >
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Email address
          </label>
          <InputField
            icon={Mail}
            type="email"
            placeholder="you@example.com"
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
          transition={{ delay: 0.15 }}
        >
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Password
          </label>
          <InputField
            icon={Lock}
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={handlePasswordChange}
            error={errors.password}
            isDirty={dirtyFields.password}
            autoComplete="new-password"
          />
          {dirtyFields.password && !errors.password && <PasswordStrengthBar password={password} />}
        </motion.div>

        {/* Submit */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="pt-2"
        >
          <motion.button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3 rounded-xl gradient-red text-white font-semibold text-sm flex items-center justify-center gap-2"
            whileHover={!loading ? { scale: 1.01 } : {}}
            whileTap={!loading ? { scale: 0.99 } : {}}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create account
                <ArrowRight size={14} />
              </>
            )}
          </motion.button>
        </motion.div>
      </form>

      {/* Login link */}
      <p className="text-xs text-[var(--text-secondary)] text-center mt-5">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onLoginClick}
          className="text-[var(--color-loss)] hover:text-[var(--text-primary)] font-semibold transition-colors"
        >
          Sign in
        </button>
      </p>
    </motion.div>
  );
}
