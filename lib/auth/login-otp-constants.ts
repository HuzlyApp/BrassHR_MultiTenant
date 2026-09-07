/** OTP code lifetime and UI countdown (seconds). */
export const LOGIN_OTP_TTL_SECONDS = 60;

/** Minimum wait before another OTP may be issued. */
export const LOGIN_OTP_RESEND_COOLDOWN_SECONDS = LOGIN_OTP_TTL_SECONDS;

/** Max "Send again" requests after the initial OTP in a window. */
export const LOGIN_OTP_MAX_RESENDS = 5;

/**
 * Rolling window used to count OTP issues for the resend cap.
 * Long enough that 5 spaced resends (60s apart) still share one window.
 */
export const LOGIN_OTP_RESEND_WINDOW_SECONDS = 15 * 60;

/** How long the post-verify proof cookie remains valid. */
export const LOGIN_OTP_PROOF_TTL_SECONDS = 600;

export const LOGIN_OTP_RESEND_LIMIT_MESSAGE =
  "Too many requests. Please try again after 1 minute.";

export const LOGIN_OTP_RESEND_COOLDOWN_MESSAGE =
  "Please wait for the timer before requesting a new code.";
