export interface PasswordStrengthResult {
  score: number; // 0-100
  level: 'weak' | 'fair' | 'good' | 'strong';
  message: string;
  helperText?: string;
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  let score = 0;

  // Length: 0-20 points
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 5;
  if (password.length >= 16) score += 5;

  // Character variety: 0-70 points (0-10 each for variety + bonuses)
  if (/[a-z]/.test(password)) score += 10; // lowercase
  if (/[A-Z]/.test(password)) score += 10; // uppercase
  if (/[0-9]/.test(password)) score += 10; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 20; // special characters

  // Bonus for high entropy combinations
  const charTypes = [/[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
  if (charTypes === 4) score += 20; // bonus for all four types

  // Penalty for common patterns
  if (/(.)\1{2,}/.test(password)) score -= 10; // repeated characters
  if (/12345|qwerty|password/i.test(password)) score -= 20; // common patterns

  score = Math.max(0, Math.min(100, score)); // Clamp to 0-100

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  let message: string;
  let helperText: string | undefined;

  if (score < 30) {
    level = 'weak';
    message = 'Weak password';
    const missing = [];
    if (!/[A-Z]/.test(password)) missing.push('capitals');
    if (!/[0-9]/.test(password)) missing.push('numbers');
    if (!/[^a-zA-Z0-9]/.test(password)) missing.push('symbols');
    helperText = missing.length > 0 ? `Add ${missing.join(' and ')} for a stronger password` : 'Add more characters';
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

  return { score, level, message, helperText };
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
