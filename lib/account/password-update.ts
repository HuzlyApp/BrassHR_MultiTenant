import type { SupabaseClient } from "@supabase/supabase-js";

export const PASSWORD_UPDATE_SUCCESS_MESSAGE =
  "Password updated successfully. Please use your new password next time you sign in.";

export type PasswordRules = {
  minLength: boolean;
  hasNumber: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  passwordsMatch: boolean;
};

export function getPasswordRules(newPassword: string, confirmPassword: string): PasswordRules {
  return {
    minLength: newPassword.length >= 8,
    hasNumber: /\d/.test(newPassword),
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    passwordsMatch: newPassword.length > 0 && newPassword === confirmPassword,
  };
}

export function isPasswordStrongEnough(rules: PasswordRules): boolean {
  return rules.minLength && rules.hasNumber && rules.hasUpper && rules.hasLower;
}

/** Returns a user-facing validation error, or null when the form is valid. */
export function validatePasswordUpdate(newPassword: string, confirmPassword: string): string | null {
  if (!newPassword.trim()) return "New password is required.";
  if (!confirmPassword.trim()) return "Confirm password is required.";

  const rules = getPasswordRules(newPassword, confirmPassword);
  if (!rules.passwordsMatch) return "Passwords do not match.";
  if (!rules.minLength) return "Password must be at least 8 characters.";
  if (!rules.hasNumber) return "Password must contain at least 1 number.";
  if (!rules.hasUpper) return "Password must contain an uppercase letter.";
  if (!rules.hasLower) return "Password must contain a lowercase letter.";

  return null;
}

/**
 * Updates the authenticated user's Supabase Auth password using the active session.
 * Never writes passwords to public database tables.
 */
export async function updateAuthUserPassword(
  supabase: Pick<SupabaseClient, "auth">,
  newPassword: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
