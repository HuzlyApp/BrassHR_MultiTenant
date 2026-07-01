import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluatePasswordPolicy,
  isPasswordPolicySatisfied,
  PASSWORD_MIN_LENGTH,
  passwordPolicyValidationError,
  passwordStrengthValidationError,
  type PasswordPolicyRules,
} from "@/lib/auth/password-policy";

export const PASSWORD_UPDATE_SUCCESS_MESSAGE =
  "Password updated successfully. Please use your new password next time you sign in.";

export type PasswordRules = PasswordPolicyRules;

export function getPasswordRules(newPassword: string, confirmPassword: string): PasswordRules {
  return evaluatePasswordPolicy(newPassword, confirmPassword);
}

export function isPasswordStrongEnough(rules: PasswordRules): boolean {
  return (
    rules.minLength &&
    rules.maxLength &&
    rules.hasUpper &&
    rules.hasLower &&
    rules.hasNumber &&
    rules.hasSpecial &&
    rules.notCommon
  );
}

/** Returns a user-facing validation error, or null when the form is valid. */
export function validatePasswordUpdate(newPassword: string, confirmPassword: string): string | null {
  return passwordPolicyValidationError(newPassword, confirmPassword);
}

/**
 * Updates the authenticated user's Supabase Auth password using the active session.
 * Never writes passwords to public database tables.
 */
export async function updateAuthUserPassword(
  supabase: Pick<SupabaseClient, "auth">,
  newPassword: string
): Promise<void> {
  const validationError = passwordStrengthValidationError(newPassword);
  if (validationError) {
    throw new Error(validationError);
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export { PASSWORD_MIN_LENGTH };
