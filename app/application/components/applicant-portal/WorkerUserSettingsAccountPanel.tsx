"use client";

import { FormEvent, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import {
  authenticatorIssuer,
  cancelAuthenticatorEnrollment,
  enrollAuthenticator,
  formatAuthenticatorSecret,
  listAuthenticatorFactors,
  removeAuthenticator,
  verifyAuthenticatorCode,
  type AuthenticatorFactor,
} from "@/lib/auth/authenticator-mfa";
import {
  getPasswordRules,
  isPasswordStrongEnough,
  PASSWORD_UPDATE_SUCCESS_MESSAGE,
  updateAuthUserPassword,
  validatePasswordUpdate,
} from "@/lib/account/password-update";
import { EASTERN_TIME_LABEL, EASTERN_TIME_ZONE } from "@/lib/datetime/eastern";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  WORKER_BTN_OUTLINE,
  WORKER_BTN_PRIMARY,
  WORKER_BTN_PRIMARY_SM,
} from "./worker-portal-buttons";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
} from "./worker-schedule-typography";

type Preferences = {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
};

const DEFAULT_PREFERENCES: Preferences = {
  language: "en-US",
  timezone: EASTERN_TIME_ZONE,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";

const LANGUAGE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "es-US", label: "Spanish (US)" },
];

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour (AM/PM)" },
  { value: "24h", label: "24-hour" },
];

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-[#374151]">
      {children}
    </label>
  );
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function WorkerUserSettingsAccountPanel() {
  const router = useRouter();
  const branding = useTenantBranding();
  const { sessionReady, authHeaders, session } = useApplicantPortal();
  const codeId = useId();
  const pendingFactorId = useRef<string | null>(null);

  const [email, setEmail] = useState("");
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [nextEmail, setNextEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [mfaLoading, setMfaLoading] = useState(true);
  const [verified, setVerified] = useState<AuthenticatorFactor | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");
        const res = await fetch("/api/applicant-portal/user-settings", {
          headers,
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          profile?: { email?: string };
          preferences?: Preferences;
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load account settings.");
        if (!alive) return;
        setEmail(payload.profile?.email ?? session?.applicant.email ?? "");
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...(payload.preferences ?? {}),
          timezone: EASTERN_TIME_ZONE,
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load account settings.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authHeaders, session?.applicant.email, sessionReady]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const factors = await listAuthenticatorFactors(supabaseBrowser);
        if (cancelled) return;
        setVerified(factors.find((factor) => factor.status === "verified") ?? null);
      } catch (err) {
        if (!cancelled) setMfaError(messageFrom(err, "Could not load two-factor settings."));
      } finally {
        if (!cancelled) setMfaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      const id = pendingFactorId.current;
      pendingFactorId.current = null;
      if (!id) return;
      void cancelAuthenticatorEnrollment(supabaseBrowser, id).catch(() => undefined);
    };
  }, []);

  const passwordRules = getPasswordRules(newPassword, confirmPassword);
  const canSavePassword =
    isPasswordStrongEnough(passwordRules) &&
    confirmPassword.length > 0 &&
    passwordRules.passwordsMatch;

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    setSavingPrefs(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/user-settings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "preferences",
          ...preferences,
          timezone: EASTERN_TIME_ZONE,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        preferences?: Preferences;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not save preferences.");
      setPreferences({
        ...DEFAULT_PREFERENCES,
        ...(payload.preferences ?? preferences),
        timezone: EASTERN_TIME_ZONE,
      });
      toast.success("Preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleChangeEmail(event: FormEvent) {
    event.preventDefault();
    const trimmed = nextEmail.trim();
    if (!trimmed) {
      toast.error("Enter a new email address.");
      return;
    }
    setEmailBusy(true);
    try {
      const { error: updateError } = await supabaseBrowser.auth.updateUser({ email: trimmed });
      if (updateError) throw updateError;
      toast.success("Check your inbox to confirm the new email.");
      setEmailModalOpen(false);
      setNextEmail("");
    } catch (err) {
      toast.error(messageFrom(err, "Could not update email."));
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    const validationError = validatePasswordUpdate(newPassword, confirmPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setPasswordBusy(true);
    try {
      await updateAuthUserPassword(supabaseBrowser, newPassword);
      toast.success(PASSWORD_UPDATE_SUCCESS_MESSAGE);
      setPasswordModalOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(messageFrom(err, "Could not update password."));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function startEnrollment() {
    setMfaBusy(true);
    setMfaError(null);
    try {
      const issuer = authenticatorIssuer(branding.companyName || "ZipStaff");
      const enrollment = await enrollAuthenticator(supabaseBrowser, issuer);
      pendingFactorId.current = enrollment.factorId;
      setFactorId(enrollment.factorId);
      setQrSrc(enrollment.qrSrc);
      setSecret(enrollment.secret);
      setEnrolling(true);
    } catch (err) {
      setMfaError(messageFrom(err, "Could not start 2FA setup."));
    } finally {
      setMfaBusy(false);
    }
  }

  async function enableAuthenticator(event: FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setMfaBusy(true);
    setMfaError(null);
    try {
      await verifyAuthenticatorCode(supabaseBrowser, factorId, code);
      pendingFactorId.current = null;
      const factors = await listAuthenticatorFactors(supabaseBrowser);
      setVerified(factors.find((factor) => factor.status === "verified") ?? null);
      setEnrolling(false);
      setFactorId(null);
      setQrSrc(null);
      setSecret(null);
      setCode("");
      toast.success("Two-factor authentication enabled.");
    } catch (err) {
      setMfaError(messageFrom(err, "Could not verify that code."));
    } finally {
      setMfaBusy(false);
    }
  }

  async function cancelEnrollment() {
    const id = factorId ?? pendingFactorId.current;
    setMfaBusy(true);
    try {
      if (id) await cancelAuthenticatorEnrollment(supabaseBrowser, id);
    } catch {
      /* ignore */
    } finally {
      pendingFactorId.current = null;
      setEnrolling(false);
      setFactorId(null);
      setQrSrc(null);
      setSecret(null);
      setCode("");
      setMfaBusy(false);
    }
  }

  async function turnOffAuthenticator() {
    if (!verified) return;
    setMfaBusy(true);
    setMfaError(null);
    try {
      await removeAuthenticator(supabaseBrowser, verified.id);
      setVerified(null);
      toast.success("Two-factor authentication turned off.");
    } catch (err) {
      setMfaError(messageFrom(err, "Could not turn off 2FA."));
    } finally {
      setMfaBusy(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/user-settings", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ section: "deactivate" }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not deactivate account.");
      await supabaseBrowser.auth.signOut();
      router.replace("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not deactivate account.");
      setDeactivating(false);
    }
  }

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-10`}>
      <div className="mb-5">
        <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
          Account
        </h1>
        <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
          Manage your login details and account preferences.
        </p>
      </div>

      <div className="space-y-5">
        <section className={`${WORKER_SCHEDULE_CARD_CLASS} p-5 sm:p-6`}>
          {loading ? (
            <div className="h-28 rounded-xl bg-[#F1F5F9] motion-safe:animate-pulse" />
          ) : (
            <>
              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="space-y-5">
                <h2 className="text-base font-semibold text-[#0F172A]">Login Information</h2>
                <div className="grid gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <FieldLabel htmlFor="account-email">Email Address</FieldLabel>
                      <input id="account-email" className={FIELD_CLASS} value={email} readOnly disabled />
                    </div>
                    <button
                      type="button"
                      className={WORKER_BTN_OUTLINE}
                      onClick={() => {
                        setNextEmail(email);
                        setEmailModalOpen(true);
                      }}
                    >
                      Change Email
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <FieldLabel htmlFor="account-password">Password</FieldLabel>
                      <input
                        id="account-password"
                        className={FIELD_CLASS}
                        value="••••••••"
                        readOnly
                        disabled
                      />
                    </div>
                    <button
                      type="button"
                      className={WORKER_BTN_OUTLINE}
                      onClick={() => setPasswordModalOpen(true)}
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={savePreferences} className="mt-8 space-y-4 border-t border-[#E5E7EB] pt-6">
                <h2 className="text-base font-semibold text-[#0F172A]">Preferences</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="account-language">Language</FieldLabel>
                    <select
                      id="account-language"
                      className={FIELD_CLASS}
                      value={preferences.language}
                      onChange={(event) =>
                        setPreferences((current) => ({ ...current, language: event.target.value }))
                      }
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="account-timezone">Timezone</FieldLabel>
                    <input
                      id="account-timezone"
                      className={FIELD_CLASS}
                      value={`(GMT-05:00) ${EASTERN_TIME_LABEL} (US & Canada)`}
                      readOnly
                      disabled
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="account-date-format">Date Format</FieldLabel>
                    <select
                      id="account-date-format"
                      className={FIELD_CLASS}
                      value={preferences.dateFormat}
                      onChange={(event) =>
                        setPreferences((current) => ({ ...current, dateFormat: event.target.value }))
                      }
                    >
                      {DATE_FORMAT_OPTIONS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="account-time-format">Time Format</FieldLabel>
                    <select
                      id="account-time-format"
                      className={FIELD_CLASS}
                      value={preferences.timeFormat}
                      onChange={(event) =>
                        setPreferences((current) => ({ ...current, timeFormat: event.target.value }))
                      }
                    >
                      {TIME_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className={WORKER_BTN_PRIMARY_SM} disabled={savingPrefs}>
                    {savingPrefs ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        <section className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#012352] shadow-sm">
                <Shield className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Two-Factor Authentication (2FA)</p>
                {mfaError ? <p className="mt-1 text-xs text-red-600">{mfaError}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`text-sm font-medium ${
                  verified ? "text-emerald-600" : "text-[#64748B]"
                }`}
              >
                • {mfaLoading ? "Checking..." : verified ? "Enabled" : "Not enabled"}
              </span>
              {verified ? (
                <button
                  type="button"
                  className={WORKER_BTN_OUTLINE}
                  disabled={mfaBusy}
                  onClick={() => void turnOffAuthenticator()}
                >
                  {mfaBusy ? "Working..." : "Disable 2FA"}
                </button>
              ) : (
                <button
                  type="button"
                  className={WORKER_BTN_PRIMARY_SM}
                  disabled={mfaBusy || mfaLoading || enrolling}
                  onClick={() => void startEnrollment()}
                >
                  {mfaBusy ? "Starting..." : "Enable 2FA"}
                </button>
              )}
            </div>
          </div>

          {enrolling && qrSrc && secret ? (
            <form onSubmit={(event) => void enableAuthenticator(event)} className="mt-4 space-y-3 border-t border-[#E5E7EB] pt-4">
              <p className="text-sm text-[#64748B]">
                Scan this QR code with your authenticator app, then enter the 6-digit code.
              </p>
              <img
                src={qrSrc}
                alt="Authenticator QR code"
                width={160}
                height={160}
                className="h-40 w-40 rounded-lg border border-[#E5E7EB] bg-white object-contain p-2"
              />
              <p className="break-all font-mono text-xs text-[#334155]">
                {formatAuthenticatorSecret(secret)}
              </p>
              <div className="max-w-xs">
                <FieldLabel htmlFor={codeId}>Verification code</FieldLabel>
                <input
                  id={codeId}
                  className={FIELD_CLASS}
                  value={code}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={WORKER_BTN_PRIMARY_SM}
                  disabled={mfaBusy || code.length !== 6}
                >
                  {mfaBusy ? "Checking..." : "Confirm"}
                </button>
                <button
                  type="button"
                  className={WORKER_BTN_OUTLINE}
                  disabled={mfaBusy}
                  onClick={() => void cancelEnrollment()}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#B91C1C] shadow-sm">
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#7F1D1D]">Deactivate Account</p>
                <p className="mt-1 max-w-xl text-sm text-[#9F1239]">
                  This will disable your worker portal access. You can contact your administrator if you
                  need the account restored later.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#DC2626] px-4 text-xs font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-50"
              onClick={() => setDeactivateOpen(true)}
            >
              Deactivate Account
            </button>
          </div>
        </section>
      </div>

      {emailModalOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(event) => void handleChangeEmail(event)}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#0F172A]">Change Email</h3>
            <p className="mt-1 text-sm text-[#64748B]">
              We may send a confirmation link to your new address before it takes effect.
            </p>
            <div className="mt-4">
              <FieldLabel htmlFor="next-email">New email</FieldLabel>
              <input
                id="next-email"
                type="email"
                className={FIELD_CLASS}
                value={nextEmail}
                onChange={(event) => setNextEmail(event.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={WORKER_BTN_OUTLINE}
                onClick={() => setEmailModalOpen(false)}
                disabled={emailBusy}
              >
                Cancel
              </button>
              <button type="submit" className={WORKER_BTN_PRIMARY} disabled={emailBusy}>
                {emailBusy ? "Saving..." : "Update Email"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {passwordModalOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={(event) => void handleChangePassword(event)}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#0F172A]">Change Password</h3>
            <p className="mt-1 text-sm text-[#64748B]">Enter and confirm a new password for this account.</p>
            <div className="mt-4 space-y-4">
              <div>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <div className="relative">
                  <input
                    id="new-password"
                    type={passwordVisible ? "text" : "password"}
                    className={`${FIELD_CLASS} pr-10`}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle
                    visible={passwordVisible}
                    onToggle={() => setPasswordVisible((current) => !current)}
                    label="New password"
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={confirmVisible ? "text" : "password"}
                    className={`${FIELD_CLASS} pr-10`}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                  <PasswordVisibilityToggle
                    visible={confirmVisible}
                    onToggle={() => setConfirmVisible((current) => !current)}
                    label="Confirm password"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={WORKER_BTN_OUTLINE}
                onClick={() => setPasswordModalOpen(false)}
                disabled={passwordBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={WORKER_BTN_PRIMARY}
                disabled={passwordBusy || !canSavePassword}
              >
                {passwordBusy ? "Saving..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deactivateOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#7F1D1D]">Deactivate account?</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              You will be signed out and lose portal access until an administrator restores your account.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={WORKER_BTN_OUTLINE}
                onClick={() => setDeactivateOpen(false)}
                disabled={deactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#DC2626] px-4 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
                disabled={deactivating}
                onClick={() => void handleDeactivate()}
              >
                {deactivating ? "Deactivating..." : "Deactivate Account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
