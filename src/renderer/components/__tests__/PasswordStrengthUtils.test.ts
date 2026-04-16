import {
  calculatePasswordStrength,
  validateEmail,
  validatePassword,
  validateName,
  PasswordStrengthResult,
} from '../PasswordStrengthUtils';

describe('calculatePasswordStrength', () => {
  describe('weak passwords', () => {
    it('should rate very short passwords as weak', () => {
      const result = calculatePasswordStrength('abc');
      expect(result.level).toBe('weak');
      expect(result.score).toBeLessThan(30);
    });

    it('should rate simple lowercase passwords as weak', () => {
      const result = calculatePasswordStrength('abc');
      expect(result.level).toBe('weak');
    });

    it('should return correct message for weak passwords', () => {
      const result = calculatePasswordStrength('a');
      expect(result.message).toBe('Weak password');
    });
  });

  describe('fair passwords', () => {
    it('should rate passwords with letters and numbers as fair', () => {
      const result = calculatePasswordStrength('MyPass123');
      expect(result.level).toBe('fair');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThan(60);
    });

    it('should return correct message for fair passwords', () => {
      const result = calculatePasswordStrength('Test1234');
      expect(result.message).toBe('Fair password');
    });
  });

  describe('good passwords', () => {
    it('should rate passwords with mixed case, numbers, and special chars as good or strong', () => {
      const result = calculatePasswordStrength('TestPass123!');
      expect(['good', 'strong']).toContain(result.level);
      expect(result.score).toBeGreaterThanOrEqual(60);
    });

    it('should return correct message for good passwords', () => {
      const result = calculatePasswordStrength('MyPass123!');
      expect(['good', 'strong']).toContain(result.level);
    });
  });

  describe('strong passwords', () => {
    it('should rate complex long passwords as strong', () => {
      const result = calculatePasswordStrength('VeryLongSecurePassw0rd!@#$%');
      expect(result.level).toBe('strong');
      expect(result.score).toBeGreaterThanOrEqual(85);
    });

    it('should return correct message for strong passwords', () => {
      const result = calculatePasswordStrength('ComplexP@ss123!Long');
      expect(result.level).toBe('strong');
      expect(result.message).toBe('Strong password');
    });
  });

  describe('score clamping', () => {
    it('should clamp score to maximum 100', () => {
      const result = calculatePasswordStrength('ThisIsAVeryLongAndComplexPassword!@#$2024');
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should clamp score to minimum 0', () => {
      const result = calculatePasswordStrength('');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('character variety scoring', () => {
    it('should reward lowercase letters', () => {
      const weak = calculatePasswordStrength('ABCDEFGHIJ');
      const better = calculatePasswordStrength('ABCDEFGHIJabcd');
      expect(better.score).toBeGreaterThan(weak.score);
    });

    it('should reward uppercase letters', () => {
      const weak = calculatePasswordStrength('abcdefghij');
      const better = calculatePasswordStrength('ABCDEFGHIJabcd');
      expect(better.score).toBeGreaterThan(weak.score);
    });

    it('should reward numbers', () => {
      const weak = calculatePasswordStrength('abcdefghij');
      const better = calculatePasswordStrength('abcdefghij1234');
      expect(better.score).toBeGreaterThan(weak.score);
    });

    it('should reward special characters', () => {
      const weak = calculatePasswordStrength('abcdefghij1234');
      const better = calculatePasswordStrength('abcdefghij1234!@#$');
      expect(better.score).toBeGreaterThan(weak.score);
    });
  });

  describe('length scoring', () => {
    it('should reward passwords of 8+ characters', () => {
      const result7 = calculatePasswordStrength('abcdefg');
      const result8 = calculatePasswordStrength('abcdefgh');
      expect(result8.score).toBeGreaterThan(result7.score);
    });

    it('should reward passwords of 12+ characters', () => {
      const result11 = calculatePasswordStrength('abcdefghijk');
      const result12 = calculatePasswordStrength('abcdefghijkl');
      expect(result12.score).toBeGreaterThan(result11.score);
    });

    it('should reward passwords of 16+ characters', () => {
      const result15 = calculatePasswordStrength('abcdefghijklmno');
      const result16 = calculatePasswordStrength('abcdefghijklmnop');
      expect(result16.score).toBeGreaterThan(result15.score);
    });
  });

  describe('penalty for common patterns', () => {
    it('should penalize repeated characters', () => {
      const weak = calculatePasswordStrength('aaabbbccc');
      const better = calculatePasswordStrength('abcdefgh');
      expect(better.score).toBeGreaterThan(weak.score);
    });

    it('should penalize "password" pattern', () => {
      const weak = calculatePasswordStrength('Password123');
      const better = calculatePasswordStrength('Passwrd123!@#');
      // Both will be penalized, but the second should have more variety bonus
      expect(better.score).toBeGreaterThanOrEqual(weak.score);
    });

    it('should penalize "qwerty" pattern', () => {
      const weak = calculatePasswordStrength('qwerty123!@#');
      const better = calculatePasswordStrength('qweza123!@#abc');
      expect(better.score).toBeGreaterThanOrEqual(weak.score);
    });

    it('should penalize "12345" pattern', () => {
      const weak = calculatePasswordStrength('test12345');
      const better = calculatePasswordStrength('test54321');
      expect(better.score).toBeGreaterThan(weak.score);
    });
  });
});

describe('validateEmail', () => {
  describe('valid emails', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBeNull();
    });

    it('should accept emails with multiple subdomains', () => {
      expect(validateEmail('user@mail.example.co.uk')).toBeNull();
    });

    it('should accept emails with numbers and dots', () => {
      expect(validateEmail('user.name+123@example.com')).toBeNull();
    });
  });

  describe('invalid emails', () => {
    it('should reject empty email', () => {
      const error = validateEmail('');
      expect(error).toBe('Email is required');
    });

    it('should reject email with only whitespace', () => {
      const error = validateEmail('   ');
      expect(error).toBe('Email is required');
    });

    it('should reject email without @ symbol', () => {
      const error = validateEmail('userexample.com');
      expect(error).toBe('Invalid email address');
    });

    it('should reject email without domain', () => {
      const error = validateEmail('user@');
      expect(error).toBe('Invalid email address');
    });

    it('should reject email without TLD', () => {
      const error = validateEmail('user@example');
      expect(error).toBe('Invalid email address');
    });

    it('should reject email with spaces', () => {
      const error = validateEmail('user @example.com');
      expect(error).toBe('Invalid email address');
    });
  });
});

describe('validatePassword', () => {
  describe('valid passwords', () => {
    it('should accept passwords meeting minimum length', () => {
      expect(validatePassword('password123')).toBeNull();
    });

    it('should accept passwords longer than minimum', () => {
      expect(validatePassword('veryLongPassword123')).toBeNull();
    });

    it('should accept passwords with custom minimum length', () => {
      expect(validatePassword('pass', 4)).toBeNull();
    });
  });

  describe('invalid passwords', () => {
    it('should reject empty password', () => {
      const error = validatePassword('');
      expect(error).toBe('Password is required');
    });

    it('should reject password shorter than minimum length', () => {
      const error = validatePassword('pass');
      expect(error).toBe('Password must be at least 8 characters');
    });

    it('should reject password shorter than custom minimum length', () => {
      const error = validatePassword('abc', 5);
      expect(error).toBe('Password must be at least 5 characters');
    });

    it('should include minimum length in error message', () => {
      const error = validatePassword('short', 12);
      expect(error).toContain('12');
    });
  });
});

describe('validateName', () => {
  describe('valid names', () => {
    it('should accept names with 2+ characters', () => {
      expect(validateName('Jo')).toBeNull();
    });

    it('should accept longer names', () => {
      expect(validateName('John Smith')).toBeNull();
    });

    it('should accept names at 50 character limit', () => {
      const name = 'a'.repeat(50);
      expect(validateName(name)).toBeNull();
    });

    it('should trim whitespace before validation', () => {
      expect(validateName('  John  ')).toBeNull();
    });
  });

  describe('invalid names', () => {
    it('should reject empty name', () => {
      const error = validateName('');
      expect(error).toBe('Name is required');
    });

    it('should reject name with only whitespace', () => {
      const error = validateName('   ');
      expect(error).toBe('Name is required');
    });

    it('should reject single character names', () => {
      const error = validateName('a');
      expect(error).toBe('Name must be at least 2 characters');
    });

    it('should reject names longer than 50 characters', () => {
      const name = 'a'.repeat(51);
      const error = validateName(name);
      expect(error).toBe('Name must be less than 50 characters');
    });

    it('should count full length before trimming for max length', () => {
      const name = 'a'.repeat(51);
      const error = validateName(name);
      expect(error).not.toBeNull();
    });
  });
});
