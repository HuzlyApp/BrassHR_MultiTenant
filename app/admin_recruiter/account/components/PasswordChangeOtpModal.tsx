"use client";

import { Check, Clock, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { LoginAuthErrorPayload } from "@/lib/auth/login-api-errors";
import {
  formatLoginOtpCooldownMessage,
  LOGIN_OTP_MAX_RESENDS,
  LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
  LOGIN_OTP_RESEND_LIMIT_MESSAGE,
  LOGIN_OTP_TTL_SECONDS,
  parseLoginOtpCooldownSeconds,
} from "@/lib/auth/login-otp-constants";
import { LOGIN_OTP_LENGTH } from "@/lib/auth/supabase-magic-link-otp-template";

const OTP_LENGTH = LOGIN_OTP_LENGTH;

const OTP_STATUS_ICON = {
  successBg: "#16a34a",
  errorBg: "#dc2626",
  expiredBg: "#d97706",
} as const;

type PasswordChangeOtpModalProps = {
  open: boolean;
  email: string;
  submitting?: boolean;
  verified?: boolean;
  authError?: LoginAuthErrorPayload | null;
  resendCount?: number;
  maxResends?: number;
  expiresInSeconds?: number;
  resendCooldownSeconds?: number;
  onClose: () => void;
  onClearError?: () => void;
  onVerify: (code: string) => void | Promise<void>;
  onSendAgain: () => void | Promise<void>;
};

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function PasswordChangeOtpModal({
  open,
  email,
  submitting = false,
  verified = false,
  authError = null,
  resendCount = 0,
  maxResends = LOGIN_OTP_MAX_RESENDS,
  expiresInSeconds = LOGIN_OTP_TTL_SECONDS,
  resendCooldownSeconds = LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
  onClose,
  onClearError,
  onVerify,
  onSendAgain,
}: PasswordChangeOtpModalProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""));
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(expiresInSeconds);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(resendCooldownSeconds);
  const [sendingAgain, setSendingAgain] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [resendLimitReached, setResendLimitReached] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
    setOtpSecondsLeft(expiresInSeconds);
    setResendSecondsLeft(resendCooldownSeconds);
    setTimerExpired(false);
    setResendLimitReached(false);
    setSendingAgain(false);
    const focusTimer = window.setTimeout(() => inputRefs.current[0]?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [open, expiresInSeconds, resendCooldownSeconds]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !verified) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose, submitting, verified]);

  useEffect(() => {
    if (resendCount >= maxResends) setResendLimitReached(true);
  }, [resendCount, maxResends]);

  useEffect(() => {
    if (!authError) return;
    if (authError.code === "RATE_LIMIT") {
      if (authError.error.toLowerCase().includes("wait for the timer")) {
        const sec =
          authError.retryAfterSec ??
          parseLoginOtpCooldownSeconds(authError.error) ??
          resendCooldownSeconds;
        setResendSecondsLeft(sec);
      } else {
        setResendLimitReached(true);
      }
    }
  }, [authError, resendCooldownSeconds]);

  useEffect(() => {
    if (!open || otpSecondsLeft <= 0) {
      if (open && otpSecondsLeft <= 0) setTimerExpired(true);
      return;
    }
    const timer = window.setInterval(() => {
      setOtpSecondsLeft((current) => {
        if (current <= 1) {
          setTimerExpired(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, otpSecondsLeft]);

  useEffect(() => {
    if (!open || resendSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setResendSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, resendSecondsLeft]);

  const code = useMemo(() => digits.join(""), [digits]);
  const isComplete = code.length === OTP_LENGTH && digits.every((digit) => digit.length === 1);
  const otpHasError = authError != null;
  const otpExpired = timerExpired || authError?.code === "OTP_EXPIRED";
  const isCooldownError =
    authError?.code === "RATE_LIMIT" &&
    Boolean(authError.error?.toLowerCase().includes("wait for the timer"));
  const showResendLimit = resendLimitReached || (authError?.code === "RATE_LIMIT" && !isCooldownError);
  const canSendAgain =
    resendSecondsLeft <= 0 &&
    !sendingAgain &&
    !submitting &&
    !verified &&
    !resendLimitReached &&
    resendCount < maxResends;

  const updateDigit = (index: number, value: string) => {
    onClearError?.();
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = nextDigit;
      return next;
    });
    if (nextDigit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    onClearError?.();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    setDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pasted[index] ?? ""));
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSendAgain = async () => {
    if (!canSendAgain) return;
    setSendingAgain(true);
    try {
      await onSendAgain();
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      setTimerExpired(false);
      setOtpSecondsLeft(expiresInSeconds);
      setResendSecondsLeft(resendCooldownSeconds);
      inputRefs.current[0]?.focus();
    } catch {
      /* Parent sets authError */
    } finally {
      setSendingAgain(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete || submitting || verified || timerExpired) return;
    void onVerify(code);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-[2px]"
      role="presentation"
      onClick={() => {
        if (!submitting && !verified) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-otp-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="password-change-otp-title"
              className="text-xl font-semibold leading-7 text-[#012352]"
            >
              Enter Code
            </h2>
            <p className="mt-2 text-sm text-[#64748B]">
              We&apos;ve sent a verification code to this email.
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0F172A]">{email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || verified}
            className="rounded-lg p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:opacity-50"
            aria-label="Close verification dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          {showResendLimit ? (
            <div role="alert" className="mb-4 flex items-center gap-2 text-sm text-[#374151]">
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: OTP_STATUS_ICON.errorBg }}
                aria-hidden
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="font-semibold text-[#991b1b]">
                {authError?.error ?? LOGIN_OTP_RESEND_LIMIT_MESSAGE}
              </span>
            </div>
          ) : otpHasError || otpExpired ? (
            <div role="alert" className="mb-4 flex items-center gap-2 text-sm text-[#374151]">
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: otpExpired
                    ? OTP_STATUS_ICON.expiredBg
                    : OTP_STATUS_ICON.errorBg,
                }}
                aria-hidden
              >
                {otpExpired ? (
                  <Clock className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <X className="h-3 w-3" strokeWidth={3} />
                )}
              </span>
              <span>
                {otpExpired ? (
                  <>
                    <span className="font-semibold text-[#92400e]">OTP expired.</span>{" "}
                    {authError?.code === "OTP_EXPIRED"
                      ? (authError.error ?? "Request a new code and try again.")
                      : "Request a new code and try again."}
                  </>
                ) : isCooldownError ? (
                  <>
                    <span className="font-semibold text-[#991b1b]">Please wait.</span>{" "}
                    {authError?.error ?? formatLoginOtpCooldownMessage(resendSecondsLeft)}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-[#991b1b]">Wrong OTP.</span>{" "}
                    {authError?.error ?? "Check the code and try again."}
                  </>
                )}
              </span>
            </div>
          ) : verified ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-[#374151]">
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: OTP_STATUS_ICON.successBg }}
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="font-semibold text-[#166534]">OTP verified.</span>
            </div>
          ) : null}

          <p className="text-sm font-semibold text-[#374151]">Enter 6 digit OTP</p>

          <div className="flex justify-center gap-2 py-5 sm:justify-start sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                disabled={submitting || verified || timerExpired}
                aria-label={`Digit ${index + 1}`}
                aria-invalid={otpHasError || otpExpired}
                className={`h-12 w-12 rounded-lg border bg-white text-center text-lg font-semibold text-[#0f172a] outline-none transition focus:border-[#012352] focus:ring-2 focus:ring-[#012352]/20 disabled:bg-[#F8FAFC] sm:h-[52px] sm:w-[52px] ${
                  otpHasError || otpExpired ? "border-[#ef4565]" : "border-[#94a3b8]"
                }`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm">
            <span className="text-[#374151]">
              Code expires in{" "}
              <span className="font-semibold text-black">{formatTimer(otpSecondsLeft)}</span>
            </span>
            <button
              type="button"
              onClick={() => void handleSendAgain()}
              disabled={!canSendAgain}
              className="font-medium text-[color:var(--brand-secondary,#012352)] hover:underline disabled:cursor-not-allowed disabled:text-[#94a3b8] disabled:no-underline"
            >
              {sendingAgain ? "Sending..." : "Send again"}
            </button>
          </div>

          <button
            type="submit"
            disabled={!isComplete || submitting || verified || timerExpired}
            className="mt-6 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#94a3b8]"
            style={
              isComplete && !submitting && !verified && !timerExpired
                ? {
                    backgroundImage:
                      "linear-gradient(90deg, var(--brand-primary, #012352) 0%, var(--brand-accent, #d89b35) 100%)",
                  }
                : undefined
            }
          >
            {submitting ? "Verifying..." : verified ? "Verified" : "Verify Code"}
          </button>
        </form>
      </div>
    </div>
  );
}
