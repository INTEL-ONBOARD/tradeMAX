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
