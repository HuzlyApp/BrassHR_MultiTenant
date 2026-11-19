/** Client-safe phone-change helpers (no Node-only imports). */

import { formatPhoneNumber, normalizePhoneInput } from "@/lib/phone";
import { phoneValidationMessage } from "@/lib/tenant/business-info-validation";

export const PHONE_CHANGE_OTP_PURPOSE = "phone_change" as const;

export const PHONE_CHANGE_OTP_SUBJECT = "Your Brass HR phone change code";

export const PHONE_CHANGE_SUCCESS_MESSAGE = "Phone number updated successfully.";

export function normalizeAccountPhone(phone: string): string {
  const digits = normalizePhoneInput(phone);
  return digits ? formatPhoneNumber(digits) : "";
}

export function validatePhoneChange(newPhone: string, currentPhone: string): string | null {
  const nextDigits = normalizePhoneInput(newPhone);
  const currentDigits = normalizePhoneInput(currentPhone);

  if (!nextDigits) {
    return "Enter a phone number to continue.";
  }

  const validationError = phoneValidationMessage(nextDigits, { required: true });
  if (validationError) return validationError;

  if (nextDigits === currentDigits) {
    return "New phone number must be different from your current phone number.";
  }

  return null;
}
