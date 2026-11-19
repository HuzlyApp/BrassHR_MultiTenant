/** Client-safe email-change helpers (no Node-only imports). */

export const EMAIL_CHANGE_OTP_PURPOSE = "email_change" as const;

export const EMAIL_CHANGE_OTP_SUBJECT = "Your Brass HR email change code";

export const EMAIL_CHANGE_SUCCESS_MESSAGE =
  "Email updated successfully. Use your new email next time you sign in.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailChange(newEmail: string, currentEmail: string): string | null {
  const next = normalizeAccountEmail(newEmail);
  const current = normalizeAccountEmail(currentEmail);
  if (!next) return "Enter a new email address.";
  if (!EMAIL_RE.test(next)) return "Enter a valid email address.";
  if (!current) return "No email is available on this account.";
  if (next === current) return "New email must be different from your current email.";
  return null;
}
