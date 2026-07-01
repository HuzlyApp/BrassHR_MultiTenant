export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "letmein",
  "welcome",
  "welcome1",
  "admin",
  "admin123",
  "secret",
  "secret1",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "abcdefgh",
  "abc123",
  "test123",
  "changeme",
  "trustno1",
  "sunshine",
  "princess",
  "login",
  "master",
]);

export type PasswordPolicyRules = {
  minLength: boolean;
  maxLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  notCommon: boolean;
  passwordsMatch: boolean;
};

export function evaluatePasswordPolicy(
  password: string,
  confirmPassword = ""
): PasswordPolicyRules {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    maxLength: password.length <= PASSWORD_MAX_LENGTH,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: SPECIAL_CHAR_REGEX.test(password),
    notCommon: !isCommonWeakPassword(password),
    passwordsMatch: password.length > 0 && password === confirmPassword,
  };
}

export function isPasswordPolicySatisfied(rules: PasswordPolicyRules): boolean {
  return (
    rules.minLength &&
    rules.maxLength &&
    rules.hasUpper &&
    rules.hasLower &&
    rules.hasNumber &&
    rules.hasSpecial &&
    rules.notCommon &&
    rules.passwordsMatch
  );
}

/** Validates password strength only (no confirm field). */
export function passwordStrengthValidationError(password: string): string | null {
  if (!password) return "Password is required.";

  const rules = evaluatePasswordPolicy(password);
  return passwordPolicyErrorFromRules(rules, { includeMatch: false });
}

/** Returns a user-facing validation error, or null when password policy is met. */
export function passwordPolicyValidationError(
  password: string,
  confirmPassword: string
): string | null {
  if (!password.trim()) return "New password is required.";
  if (!confirmPassword.trim()) return "Confirm password is required.";

  const rules = evaluatePasswordPolicy(password, confirmPassword);
  if (!rules.passwordsMatch) return "Passwords do not match.";

  return passwordPolicyErrorFromRules(rules, { includeMatch: false });
}

function passwordPolicyErrorFromRules(
  rules: PasswordPolicyRules,
  options: { includeMatch: boolean }
): string | null {
  if (!rules.minLength) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!rules.maxLength) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  if (!rules.hasUpper) return "Password must contain an uppercase letter.";
  if (!rules.hasLower) return "Password must contain a lowercase letter.";
  if (!rules.hasNumber) return "Password must contain at least one number.";
  if (!rules.hasSpecial) return "Password must contain a special character (for example ! @ # $).";
  if (!rules.notCommon) return "This password is too common. Choose a stronger password.";
  if (options.includeMatch && !rules.passwordsMatch) return "Passwords do not match.";
  return null;
}

function isCommonWeakPassword(password: string): boolean {
  const trimmed = password.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lower)) return true;

  const alphanumeric = lower.replace(/[^a-z0-9]/g, "");
  if (alphanumeric && COMMON_WEAK_PASSWORDS.has(alphanumeric)) return true;

  if (/^(.)\1{7,}$/.test(trimmed)) return true;

  return false;
}
