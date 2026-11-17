"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import SuccessModal from "@/app/components/SuccessModal";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { getAccountDisplayName } from "@/lib/account/display-name";
import { withSecurityCompleted } from "@/lib/account/completion";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import {
  getPasswordRules,
  isPasswordStrongEnough,
  PASSWORD_MIN_LENGTH,
  PASSWORD_UPDATE_SUCCESS_MESSAGE,
  updateAuthUserPassword,
  validatePasswordUpdate,
} from "@/lib/account/password-update";
import type { LoginAuthErrorPayload } from "@/lib/auth/login-api-errors";
import {
  LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
  LOGIN_OTP_TTL_SECONDS,
} from "@/lib/auth/login-otp-constants";
import { supabaseBrowser } from "@/lib/supabase-browser";
import SecuritySettingsPanel from "@/app/admin_recruiter/settings/SecuritySettingsPanel";
import { FIELD, FieldLabel } from "./account-form-fields";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
} from "./AccountFormStatus";
import AccountPreferencesPanel from "./AccountPreferencesPanel";
import PasswordChangeOtpModal from "./PasswordChangeOtpModal";

/** Fixed validation colors — never tied to tenant brand colors. */
const VALID_GREEN = "#16a34a";
const MEDIUM_YELLOW = "#d89b35";
const INVALID_RED = "#ef4565";

function FieldStatusIcon({ showValid }: { showValid: boolean }) {
  const base = "flex h-[19.2px] w-[19.2px] shrink-0 items-center justify-center rounded-full";

  if (showValid) {
    return (
      <span className={`${base}`} style={{ backgroundColor: VALID_GREEN }} aria-hidden>
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      className={`${base} bg-white border`}
      style={{ borderColor: INVALID_RED }}
      aria-hidden
    >
      <X className="h-2.5 w-2.5" strokeWidth={3} style={{ color: INVALID_RED }} />
    </span>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <FieldStatusIcon showValid={met} />
      <span className="text-sm" style={{ color: met ? VALID_GREEN : INVALID_RED }}>
        {label}
      </span>
    </li>
  );
}

function getPasswordStrength(score: number, maxScore: number) {
  if (score >= maxScore) {
    return { label: "Strong", color: VALID_GREEN, filledSegments: 5 };
  }
  if (score >= maxScore - 1) {
    return { label: "Medium", color: MEDIUM_YELLOW, filledSegments: 4 };
  }
  if (score >= 2) {
    return { label: "Medium", color: MEDIUM_YELLOW, filledSegments: Math.max(score, 2) };
  }
  return { label: "Weak", color: INVALID_RED, filledSegments: score > 0 ? Math.max(score, 1) : 0 };
}

function PasswordStrengthMeter({ score, maxScore }: { score: number; maxScore: number }) {
  const strength = getPasswordStrength(score, maxScore);

  return (
    <div className="mt-1">
      <div className="grid grid-cols-5 gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="h-[5px] rounded-full"
            style={{ backgroundColor: index < strength.filledSegments ? strength.color : "#e4e9f0" }}
            aria-hidden
          />
        ))}
      </div>
      <p className="mt-1.5 text-right text-xs font-medium" style={{ color: strength.color }}>
        {strength.label}
      </p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  showValid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  showValid: boolean;
}) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="block">
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            id={inputId}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD} w-full pr-10`}
            autoComplete="new-password"
          />
          <PasswordVisibilityToggle
            visible={visible}
            onToggle={() => setVisible((current) => !current)}
            label={label}
          />
        </div>
        <FieldStatusIcon showValid={showValid} />
      </div>
    </div>
  );
}

export default function SecurityTab() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState<LoginAuthErrorPayload | null>(null);
  const [otpResendCount, setOtpResendCount] = useState(0);
  const [otpMaxResends, setOtpMaxResends] = useState(5);
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState(LOGIN_OTP_TTL_SECONDS);
  const [otpResendCooldownSeconds, setOtpResendCooldownSeconds] = useState(
    LOGIN_OTP_RESEND_COOLDOWN_SECONDS
  );
  const [successOpen, setSuccessOpen] = useState(false);

  const displayName = getAccountDisplayName(profile, user);
  const email = user?.email ?? profile?.email ?? "";

  const rules = useMemo(
    () => getPasswordRules(newPassword, confirmPassword),
    [newPassword, confirmPassword]
  );

  const newValid = isPasswordStrongEnough(rules);
  const confirmValid = confirmPassword.length > 0 && rules.passwordsMatch;
  const currentValid = currentPassword.trim().length > 0;
  const canSubmit = currentValid && newValid && confirmValid;

  const strengthChecks = [
    rules.minLength,
    rules.hasUpper,
    rules.hasLower,
    rules.hasNumber,
    rules.hasSpecial,
    rules.notCommon,
  ];
  const strengthScore = strengthChecks.filter(Boolean).length;
  const strengthMaxScore = strengthChecks.length;

  const parseAuthError = async (res: Response): Promise<LoginAuthErrorPayload> => {
    const json = (await res.json().catch(() => ({}))) as Partial<LoginAuthErrorPayload>;
    return {
      error: typeof json.error === "string" ? json.error : "Something went wrong. Try again.",
      code: json.code ?? "UNKNOWN",
      field: json.field ?? null,
      ...(typeof json.retryAfterSec === "number" ? { retryAfterSec: json.retryAfterSec } : {}),
    };
  };

  const requestPasswordChangeOtp = async () => {
    const res = await fetch("/api/account/password-change/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    if (!res.ok) {
      throw await parseAuthError(res);
    }

    const json = (await res.json()) as {
      resendCount?: number;
      maxResends?: number;
      expiresInSeconds?: number;
      resendAvailableInSeconds?: number;
    };

    setOtpResendCount(typeof json.resendCount === "number" ? json.resendCount : 0);
    setOtpMaxResends(typeof json.maxResends === "number" ? json.maxResends : 5);
    setOtpExpiresInSeconds(
      typeof json.expiresInSeconds === "number" ? json.expiresInSeconds : LOGIN_OTP_TTL_SECONDS
    );
    setOtpResendCooldownSeconds(
      typeof json.resendAvailableInSeconds === "number"
        ? json.resendAvailableInSeconds
        : LOGIN_OTP_RESEND_COOLDOWN_SECONDS
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    if (!currentPassword.trim()) {
      setSaveError("Enter your current password to continue.");
      return;
    }

    const validationError = validatePasswordUpdate(newPassword, confirmPassword);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    if (!email) {
      setSaveError("No email is available on this account to verify the current password.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setOtpError(null);
    setOtpVerified(false);

    try {
      // Verify current password + send OTP on the server (ephemeral auth).
      // Do NOT call browser signInWithPassword — that replaces the session and can log the user out.
      await requestPasswordChangeOtp();
      setOtpOpen(true);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setSaveError(err.error);
      } else {
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "Failed to start password update";
        setSaveError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOtpSendAgain = async () => {
    setOtpError(null);
    try {
      await requestPasswordChangeOtp();
    } catch (err) {
      if (err && typeof err === "object" && "error" in err) {
        setOtpError(err as LoginAuthErrorPayload);
        throw err;
      }
      const payload: LoginAuthErrorPayload = {
        error: "Could not send verification code. Try again.",
        code: "OTP_SEND_FAILED",
        field: null,
      };
      setOtpError(payload);
      throw payload;
    }
  };

  const handleOtpVerify = async (code: string) => {
    if (!user?.id) return;

    setOtpSubmitting(true);
    setOtpError(null);

    try {
      const confirmRes = await fetch("/api/account/password-change/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          newPassword,
          confirmPassword,
        }),
      });

      if (!confirmRes.ok) {
        throw await parseAuthError(confirmRes);
      }

      setOtpVerified(true);

      // Update password with the existing browser session so the user stays signed in.
      await updateAuthUserPassword(supabaseBrowser, newPassword);

      await syncAccountChecklist(supabaseBrowser, {
        user,
        profile,
        organization,
        settings,
        checklist: withSecurityCompleted(checklist, user.id),
      });
      await refresh();

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpOpen(false);
      setOtpVerified(false);
      setSuccessOpen(true);
    } catch (err) {
      if (err && typeof err === "object" && "error" in err && typeof err.error === "string") {
        setOtpError(err as LoginAuthErrorPayload);
        setOtpVerified(false);
      } else {
        const message =
          err && typeof err === "object" && "message" in err && typeof err.message === "string"
            ? err.message
            : "Failed to update password";
        setOtpError({ error: message, code: "UNKNOWN", field: null });
        setOtpVerified(false);
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold leading-7 text-[#012352]">Security</h2>
        <p className="mt-2 text-sm text-[#64748B]">
          Update your password and manage authenticator app protection for this account.
        </p>

        {error ? <AccountErrorBanner message={error} /> : null}
        {saveError ? <AccountErrorBanner message={saveError} /> : null}

        <div className="mt-4 w-full">
          <div className="border-b border-[#E5E7EB] pb-5">
            <p className="text-base font-semibold text-[#012352]">{displayName}</p>
            <p className="mt-1 text-sm text-[#64748B]">{email}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <h3 className="text-base font-semibold text-[#012352]">Update Password</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              Enter your current password, then choose a new password.
            </p>

            <div className="mt-5 flex flex-col gap-5">
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                showValid={currentValid}
              />
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                showValid={newValid}
              />
              <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                showValid={confirmValid}
              />

              {newPassword.length > 0 ? (
                <PasswordStrengthMeter score={strengthScore} maxScore={strengthMaxScore} />
              ) : null}
            </div>

            <ul className="mt-6 flex flex-col gap-3" aria-label="Password requirements">
              <RequirementItem met={rules.minLength} label={`${PASSWORD_MIN_LENGTH} or more characters`} />
              <RequirementItem met={rules.hasUpper} label="Uppercase letter" />
              <RequirementItem met={rules.hasLower} label="Lowercase letter" />
              <RequirementItem met={rules.hasNumber} label="At least 1 number" />
              <RequirementItem met={rules.hasSpecial} label="Special character (! @ # $ …)" />
              <RequirementItem met={rules.notCommon} label="Not a common password" />
              <RequirementItem met={rules.passwordsMatch} label="Passwords match" />
            </ul>

            <div className="mt-6 flex justify-end">
              <AccountSaveButton saving={saving} disabled={!canSubmit} label="Update Password" />
            </div>
          </form>

          <SecuritySettingsPanel embedded />
        </div>
      </div>

      <AccountPreferencesPanel variant="mfa-deactivate" />

      <PasswordChangeOtpModal
        open={otpOpen}
        email={email}
        submitting={otpSubmitting}
        verified={otpVerified}
        authError={otpError}
        resendCount={otpResendCount}
        maxResends={otpMaxResends}
        expiresInSeconds={otpExpiresInSeconds}
        resendCooldownSeconds={otpResendCooldownSeconds}
        onClose={() => {
          if (otpSubmitting) return;
          setOtpOpen(false);
          setOtpError(null);
          setOtpVerified(false);
        }}
        onClearError={() => setOtpError(null)}
        onVerify={handleOtpVerify}
        onSendAgain={handleOtpSendAgain}
      />

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Password updated"
        message={PASSWORD_UPDATE_SUCCESS_MESSAGE}
        autoCloseMs={4000}
      />
    </div>
  );
}
