import {
  classifyAuthMessage,
  classifyVerifyMessage,
  type LoginAuthErrorPayload,
} from "@/lib/auth/login-api-errors";

export { LOGIN_OTP_LENGTH } from "@/lib/auth/supabase-magic-link-otp-template";
export {
  LOGIN_OTP_PURPOSE,
  createLoginOtp,
  hashLoginOtp,
  verifyLoginOtp,
} from "@/lib/auth/login-otp-store";

export type LoginOtpSendResult = {
  ok: true;
  godAdmin: boolean;
  requiresOtp: boolean;
  email: string;
};

export function normalizeOtpSendError(message: string | undefined): string {
  return classifyAuthMessage(message).error;
}

export function normalizeOtpVerifyError(message: string | undefined): string {
  return classifyVerifyMessage(message).error;
}

export function toOtpVerifyError(message: string | undefined): LoginAuthErrorPayload {
  return { ...classifyVerifyMessage(message), field: null };
}
