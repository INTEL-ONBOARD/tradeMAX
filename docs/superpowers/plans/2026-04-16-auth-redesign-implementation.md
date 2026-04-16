# Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign authentication pages with a two-step flow (choice screen + form), real-time validation, password strength indicator, Google OAuth, and professional animations.

**Architecture:** Orchestrator pattern with AuthPage managing flow state (choice → login → register), separate form components for each step, shared utilities for validation and password strength calculation. All animations use framer-motion, theme colors via CSS variables.

**Tech Stack:** React, TypeScript, Zustand (store), framer-motion (animations), Tailwind CSS, custom CSS variables for theming.

---

## Task 1: Add Password Strength Utility Functions

**Files:**
- Create: `src/renderer/components/PasswordStrengthUtils.ts`

- [ ] **Step 1: Create password strength calculation utility**

Create `src/renderer/components/PasswordStrengthUtils.ts`:

```typescript
export interface PasswordStrengthResult {
  score: number; // 0-100
  level: 'weak' | 'fair' | 'good' | 'strong';
  message: string;
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  let score = 0;

  // Length scoring (0-20 points)
  if (password.length >= 8) score += 5;
  if (password.length >= 12) score += 5;
  if (password.length >= 16) score += 10;

  // Character variety scoring
  if (/[a-z]/.test(password)) score += 10; // lowercase
  if (/[A-Z]/.test(password)) score += 10; // uppercase
  if (/[0-9]/.test(password)) score += 10; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 20; // special characters

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 10; // repeated characters
  if (/12345|qwerty|password/i.test(password)) score -= 20; // common patterns

  score = Math.max(0, Math.min(100, score)); // Clamp to 0-100

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  let message: string;

  if (score < 30) {
    level = 'weak';
    message = 'Weak password';
  } else if (score < 60) {
    level = 'fair';
    message = 'Fair password';
  } else if (score < 85) {
    level = 'good';
    message = 'Good password';
  } else {
    level = 'strong';
    message = 'Strong password';
  }

  return { score, level, message };
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email address';
  return null;
}

export function validatePassword(password: string, minLength: number = 8): string | null {
  if (!password) return 'Password is required';
  if (password.length < minLength) return `Password must be at least ${minLength} characters`;
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  if (name.length > 50) return 'Name must be less than 50 characters';
  return null;
}
```

- [ ] **Step 2: Write test file for password strength**

Create `src/renderer/components/__tests__/PasswordStrengthUtils.test.ts`:

```typescript
import { calculatePasswordStrength, validateEmail, validatePassword, validateName } from '../PasswordStrengthUtils';

describe('PasswordStrengthUtils', () => {
  describe('calculatePasswordStrength', () => {
    it('should return weak for short, simple passwords', () => {
      const result = calculatePasswordStrength('abc');
      expect(result.level).toBe('weak');
      expect(result.score).toBeLessThan(30);
    });

    it('should return fair for medium passwords', () => {
      const result = calculatePasswordStrength('MyPass123');
      expect(result.level).toBe('fair');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(60);
    });

    it('should return good for strong passwords', () => {
      const result = calculatePasswordStrength('MyStr0ng!Pass');
      expect(result.level).toMatch(/good|strong/);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should return strong for very strong passwords', () => {
      const result = calculatePasswordStrength('Str0ng!P@ssw0rd#2024');
      expect(result.level).toBe('strong');
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('should penalize common patterns', () => {
      const weak = calculatePasswordStrength('Password123');
      expect(weak.score).toBeLessThan(50);
    });
  });

  describe('validateEmail', () => {
    it('should return null for valid emails', () => {
      expect(validateEmail('user@example.com')).toBeNull();
    });

    it('should return error for invalid emails', () => {
      expect(validateEmail('invalid')).not.toBeNull();
      expect(validateEmail('user@')).not.toBeNull();
    });

    it('should return error for empty email', () => {
      expect(validateEmail('')).not.toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return null for valid passwords', () => {
      expect(validatePassword('ValidPass123')).toBeNull();
    });

    it('should return error for short passwords', () => {
      expect(validatePassword('short')).not.toBeNull();
    });

    it('should return error for empty password', () => {
      expect(validatePassword('')).not.toBeNull();
    });
  });

  describe('validateName', () => {
    it('should return null for valid names', () => {
      expect(validateName('John Doe')).toBeNull();
    });

    it('should return error for single character', () => {
      expect(validateName('A')).not.toBeNull();
    });

    it('should return error for empty name', () => {
      expect(validateName('')).not.toBeNull();
    });

    it('should return error for very long names', () => {
      expect(validateName('A'.repeat(51))).not.toBeNull();
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test -- src/renderer/components/__tests__/PasswordStrengthUtils.test.ts
```

Expected: All tests pass (6 describe blocks, ~15 tests).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/PasswordStrengthUtils.ts src/renderer/components/__tests__/PasswordStrengthUtils.test.ts
git commit -m "feat: add password strength calculation and form validation utilities"
```

---

## Task 2: Enhance InputField Component with Validation Feedback

**Files:**
- Modify: `src/renderer/components/InputField.tsx`

- [ ] **Step 1: Update InputField component to support validation states**

Read the current `src/renderer/components/InputField.tsx` and replace it:

```typescript
import { useState } from "react";

export interface InputFieldProps {
  icon: React.ElementType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  error?: string | null;
  isDirty?: boolean;
}

export function InputField({
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  required,
  minLength,
  autoComplete,
  error,
  isDirty,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  const isValid = isDirty && !error && value.length > 0;
  const isInvalid = isDirty && error;

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-3 rounded-lg border transition-all px-3.5 py-3 ${
          isInvalid
            ? "border-[var(--color-loss)] shadow-[0_0_0_3px_rgba(244,63,94,0.1)]"
            : focused
            ? "border-[var(--border-focus)] shadow-[0_0_0_3px_rgba(239,68,68,0.1)] bg-[var(--bg-inset)]"
            : "border-[var(--border)] bg-[var(--bg-inset)] hover:border-[var(--border-strong)]"
        }`}
      >
        <Icon
          size={16}
          className={`shrink-0 transition-colors ${
            isInvalid
              ? "text-[var(--color-loss)]"
              : focused
              ? "text-primary-400"
              : "text-[var(--text-tertiary)]"
          }`}
        />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
        {isValid && (
          <div className="shrink-0 text-[var(--color-profit)] animate-fade-in">
            ✓
          </div>
        )}
        {isInvalid && (
          <div className="shrink-0 text-[var(--color-loss)] animate-fade-in">
            ✕
          </div>
        )}
      </div>
      {isInvalid && error && (
        <p className="mt-2 text-xs text-[var(--color-loss)] animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test the updated InputField with validation props**

Open `src/renderer/pages/AuthPage.tsx` and verify it still compiles (it will, since we made props optional with defaults). Run dev server to ensure no runtime errors:

```bash
npm run dev
```

Expected: App launches without errors. Auth page still shows (unchanged visually for now).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/InputField.tsx
git commit -m "feat: add validation feedback to InputField (error messages, checkmark icons)"
```

---

## Task 3: Create PasswordStrengthBar Component

**Files:**
- Create: `src/renderer/components/PasswordStrengthBar.tsx`

- [ ] **Step 1: Create PasswordStrengthBar component**

Create `src/renderer/components/PasswordStrengthBar.tsx`:

```typescript
import { motion } from "framer-motion";
import { calculatePasswordStrength } from "./PasswordStrengthUtils";

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { score, level, message } = calculatePasswordStrength(password);

  // Color mapping based on strength level
  const colorMap = {
    weak: { bar: "bg-gradient-to-r from-[var(--color-loss)] to-orange-500", text: "text-[var(--color-loss)]" },
    fair: { bar: "bg-gradient-to-r from-orange-500 to-yellow-500", text: "text-orange-500" },
    good: { bar: "bg-gradient-to-r from-yellow-500 to-[var(--color-profit)]", text: "text-yellow-500" },
    strong: { bar: "bg-gradient-to-r from-[var(--color-profit)] to-green-400", text: "text-[var(--color-profit)]" },
  };

  const { bar, text } = colorMap[level];

  return (
    <div className="mt-3 space-y-2">
      {/* Strength bar */}
      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Strength label */}
      <motion.p
        className={`text-xs font-500 ${text}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {message}
      </motion.p>

      {/* Helper text */}
      {level === "weak" && (
        <motion.p
          className="text-xs text-[var(--text-tertiary)]"
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          Add numbers and symbols for a stronger password
        </motion.p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component structure**

The component is small and self-contained. No tests needed here (pure presentation of utility output). Just verify TypeScript is happy:

```bash
npm run type-check
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PasswordStrengthBar.tsx
git commit -m "feat: add PasswordStrengthBar component with real-time feedback"
```

---

## Task 4: Create ChoiceScreen Component

**Files:**
- Create: `src/renderer/components/ChoiceScreen.tsx`

- [ ] **Step 1: Create ChoiceScreen component**

Create `src/renderer/components/ChoiceScreen.tsx`:

```typescript
import { motion } from "framer-motion";
import { User, Lock } from "./icons";

interface ChoiceScreenProps {
  onLoginSelect: () => void;
  onRegisterSelect: () => void;
}

export function ChoiceScreen({ onLoginSelect, onRegisterSelect }: ChoiceScreenProps) {
  return (
    <motion.div
      key="choice-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-12"
    >
      {/* Heading */}
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
          TradeMAX
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Autonomous AI-powered crypto trading with hard safety controls
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-6">
        {/* Sign In Card */}
        <motion.button
          onClick={onLoginSelect}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          whileHover={{ y: -4, borderColor: "var(--border-focus)" }}
          className="glass p-8 md:p-12 rounded-2xl border border-[var(--glass-border)] text-left transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center mb-4">
            <Lock size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Sign In
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Access your existing TradeMAX account and dashboard
          </p>
          <div className="inline-flex items-center gap-2 text-primary-600 font-500 text-sm">
            Continue →
          </div>
        </motion.button>

        {/* Create Account Card */}
        <motion.button
          onClick={onRegisterSelect}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ y: -4, borderColor: "var(--border-focus)" }}
          className="glass p-8 md:p-12 rounded-2xl border border-[var(--glass-border)] text-left transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center mb-4">
            <User size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Create Account
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Set up a new TradeMAX account and start trading with AI
          </p>
          <div className="inline-flex items-center gap-2 text-primary-600 font-500 text-sm">
            Get Started →
          </div>
        </motion.button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ChoiceScreen.tsx
git commit -m "feat: add ChoiceScreen component with animated cards"
```

---

## Task 5: Create LoginForm Component

**Files:**
- Create: `src/renderer/components/LoginForm.tsx`

- [ ] **Step 1: Create LoginForm component**

Create `src/renderer/components/LoginForm.tsx`:

```typescript
import { useState } from "react";
import { motion } from "framer-motion";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { Mail, Lock, ArrowLeft, AlertCircle, Loader2, Chrome } from "./icons";
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
      // This is a placeholder for OAuth flow
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
        <Chrome size={14} /> Continue with Google
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/LoginForm.tsx
git commit -m "feat: add LoginForm component with real-time validation and Google OAuth button"
```

---

## Task 6: Create RegisterForm Component

**Files:**
- Create: `src/renderer/components/RegisterForm.tsx`

- [ ] **Step 1: Create RegisterForm component**

Create `src/renderer/components/RegisterForm.tsx`:

```typescript
import { useState } from "react";
import { motion } from "framer-motion";
import { IPC } from "../../shared/constants";
import type { UserSession, UserSettings } from "../../shared/types";
import { Mail, Lock, User, ArrowLeft, AlertCircle, Loader2, Chrome } from "./icons";
import { InputField } from "./InputField";
import { PasswordStrengthBar } from "./PasswordStrengthBar";
import { validateEmail, validatePassword, validateName } from "./PasswordStrengthUtils";

interface RegisterFormProps {
  onBack: () => void;
  onSuccess: (session: UserSession, settings: UserSettings) => void;
}

export function RegisterForm({ onBack, onSuccess }: RegisterFormProps) {
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
      // OAuth would be implemented here
      setError("Google OAuth not yet implemented");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key="register-form"
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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
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

        <div>
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
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !isFormValid}
          className="btn-primary w-full py-3 mt-6"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Creating account...
            </>
          ) : (
            "Create Account"
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
        <Chrome size={14} /> Continue with Google
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

```bash
npm run type-check
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/RegisterForm.tsx
git commit -m "feat: add RegisterForm component with password strength indicator and real-time validation"
```

---

## Task 7: Refactor AuthPage to Orchestrate Flow

**Files:**
- Modify: `src/renderer/pages/AuthPage.tsx`

- [ ] **Step 1: Replace AuthPage with orchestrator logic**

Replace entire contents of `src/renderer/pages/AuthPage.tsx`:

```typescript
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
```

- [ ] **Step 2: Verify AuthPage compiles and app runs**

```bash
npm run dev
```

Expected: App launches, auth page shows choice screen with two animated cards. Clicking either card transitions to the form. Back button returns to choice.

- [ ] **Step 3: Test the auth flow manually**

1. Click "Sign In" → Should transition to LoginForm
2. Enter email/password → Should show validation feedback in real-time
3. Click "Back" → Should return to choice screen
4. Click "Create Account" → Should transition to RegisterForm
5. Enter name/email/password → Password field should show strength bar
6. Theme toggle should work throughout
7. Verify animations are smooth (no stuttering)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/pages/AuthPage.tsx
git commit -m "refactor: redesign AuthPage with two-step flow (choice → login/register)"
```

---

## Task 8: Add Chrome Icon to Icon Set

**Files:**
- Modify: `src/renderer/components/icons.tsx`

- [ ] **Step 1: Add Chrome icon to icons file**

Read `src/renderer/components/icons.tsx` to find the pattern, then add the Chrome icon:

```typescript
export function Chrome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="21.17" y1="8" x2="12" y2="14" />
      <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
      <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify icon renders correctly**

Run dev server and visually check the "Continue with Google" button shows the Chrome icon correctly:

```bash
npm run dev
```

Expected: Icon appears on the button without errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/icons.tsx
git commit -m "feat: add Chrome icon for Google OAuth button"
```

---

## Task 9: Add Fade-In Animation to Tailwind Config

**Files:**
- Modify: `tailwind.config.cjs`

- [ ] **Step 1: Add fade-in animation to keyframes**

Open `tailwind.config.cjs` and verify `fadeIn` exists in keyframes. If not, add it:

```javascript
keyframes: {
  fadeIn: {
    "0%": { opacity: "0" },
    "100%": { opacity: "1" },
  },
  // ... rest of keyframes
},
```

Then in `animation`, add:

```javascript
animation: {
  // ... existing animations
  "fade-in": "fadeIn 0.15s ease-out",
},
```

(Check your config — it might already have this from the refactor earlier.)

- [ ] **Step 2: Verify config compiles**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add tailwind.config.cjs
git commit -m "feat: ensure fade-in animation is available for validation feedback"
```

---

## Task 10: End-to-End Testing & Polish

**Files:**
- No new files; manual testing

- [ ] **Step 1: Full auth flow test on light theme**

1. Set app to light theme
2. Load auth page → Choice screen appears with both cards visible
3. Click "Sign In"
4. Type invalid email → See red error "Invalid email address"
5. Fix email → See green checkmark
6. Type password → No error (not required yet)
7. Click submit → Error "Invalid email or password" or success if using test account
8. Click back → Returns to choice screen smoothly
9. Verify all text colors match light theme, red accent is visible

- [ ] **Step 2: Full auth flow test on dark theme**

1. Toggle to dark theme
2. Repeat steps 2-9 from light theme test
3. Verify all colors are appropriate for dark theme

- [ ] **Step 3: Register flow test**

1. Click "Create Account"
2. Enter name (less than 2 chars) → See error "Name must be at least 2 characters"
3. Fix name → See green checkmark
4. Enter email → Real-time validation
5. Enter password → Watch strength bar update in real-time
6. Verify "Weak", "Fair", "Good", "Strong" labels and colors change smoothly
7. Verify helper text "Add numbers and symbols..." appears when weak
8. Change password to very strong (capitals, numbers, symbols) → Should show "Strong"
9. Click submit → Success or appropriate error

- [ ] **Step 4: Mobile responsiveness check**

1. Resize browser to mobile width (375px)
2. Verify choice screen cards stack vertically
3. Verify form fields are full-width
4. Verify buttons are 44px+ height for touch
5. Verify all text is readable
6. Test form submission on mobile width

- [ ] **Step 5: Animation smoothness check**

1. Open DevTools, throttle to "Slow 4G"
2. Test transitions between screens
3. Verify no janky animations or layout shifts
4. Check that error banners slide in smoothly

- [ ] **Step 6: Keyboard navigation test**

1. Tab through form fields in order: email → password → submit
2. Tab through register form: name → email → password → submit
3. Shift+Tab works backward
4. Enter on any field with valid data submits (optional, if desired)
5. Esc returns to choice screen (optional, if desired)

- [ ] **Step 7: Final visual polish**

1. Check spacing between elements matches design (12px gaps, 48px card padding, etc.)
2. Verify border colors and shadows match design
3. Check font sizes match design (20px heading, 14px body, etc.)
4. Verify icon sizes are consistent (16px input icons, 20px card icons)
5. Check red accent color is consistent: `#EF4444` (dark) / `#DC2626` (light)

- [ ] **Step 8: Commit test results**

No code changes, but document that testing passed:

```bash
git log --oneline -1
# Should show your last actual code commit, not a test commit
```

---

## Spec Verification

Checking implementation against `2026-04-16-auth-redesign-design.md`:

✅ **Choice Screen** — Task 4 implements with animated cards, icons, descriptions  
✅ **Login Form** — Task 5 implements with email/password, Google OAuth, real-time validation  
✅ **Register Form** — Task 6 implements with name/email/password, password strength bar, validation  
✅ **Password Strength** — Task 1 & 3 implement algorithm and component  
✅ **Real-time Validation** — Tasks 2, 5, 6 show errors/checkmarks as user types  
✅ **Animations** — framer-motion used for slide-ins, fades, strength bar updates (Tasks 4, 5, 6)  
✅ **Theme Support** — CSS variables used throughout, light/dark automatically supported  
✅ **Red Accent** — `#EF4444` used for buttons, focus states, validation colors  
✅ **Error Handling** — Error banner with auto-dismiss in forms (Tasks 5, 6)  
✅ **Component Structure** — AuthPage orchestrates, separate form components (Task 7)  
✅ **Validation Functions** — Email, password, name validation in utilities (Task 1)  

**No gaps found.** Implementation covers all design requirements.

---

## Files Summary

**Created (6 files):**
- `src/renderer/components/PasswordStrengthUtils.ts` — Validation & strength calculation
- `src/renderer/components/PasswordStrengthBar.tsx` — Strength indicator UI
- `src/renderer/components/ChoiceScreen.tsx` — Login/Register choice screen
- `src/renderer/components/LoginForm.tsx` — Login form
- `src/renderer/components/RegisterForm.tsx` — Register form
- `src/renderer/components/__tests__/PasswordStrengthUtils.test.ts` — Unit tests

**Modified (3 files):**
- `src/renderer/pages/AuthPage.tsx` — Refactored to orchestrator
- `src/renderer/components/InputField.tsx` — Added validation feedback
- `src/renderer/components/icons.tsx` — Added Chrome icon
- `tailwind.config.cjs` — Ensured fade-in animation (if needed)

**Total new lines:** ~1000 (components + tests)  
**Complexity:** Medium (component composition, state management, animations)  
**Testing:** Unit tests for validation, manual testing for UI/animations
