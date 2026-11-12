"use client";

import { FormEvent, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PasswordVisibilityToggle } from "@/app/components/PasswordVisibilityToggle";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { useModulePermission } from "@/lib/admin/hooks/use-staff-module-access";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
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
import { FIELD, FieldLabel, SelectField } from "./account-form-fields";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English (US)" },
  { value: "es", label: "Spanish (US)" },
];

const DATE_FORMAT_OPTIONS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour (AM/PM)" },
  { value: "24h", label: "24-hour" },
];

const BTN_OUTLINE =
  "inline-flex h-9 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-4 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50";
const BTN_SECONDARY_OUTLINE =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border bg-white px-4 text-sm font-medium hover:bg-[#F8FAFC] disabled:opacity-50";
const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50";

const BRAND_SECONDARY_STYLE = {
  color: "var(--brand-secondary, #012352)",
  borderColor: "var(--brand-secondary, #012352)",
} as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-[#0F172A]">{children}</h2>;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function normalizeLanguage(value: string | null | undefined): string {
  const raw = value?.trim() || "en";
  if (raw === "en-US" || raw === "en") return "en";
  if (raw === "es-US" || raw === "es") return "es";
  return raw;
}

export default function AccountPreferencesPanel() {
  const router = useRouter();
  const branding = useTenantBranding();
  const { user, settings, loading, error, refresh } = useAccountData();
  const { canEdit: canEditPreferences, loading: accessLoading } =
    useModulePermission("settings_profile");
  const codeId = useId();
  const pendingFactorId = useRef<string | null>(null);

  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState("en");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] = useState("12h");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
    setEmail(user?.email?.trim() ?? "");
  }, [user?.email]);

  useEffect(() => {
    if (!settings) return;
    setLanguage(normalizeLanguage(settings.language));
    setDateFormat(settings.date_format || "MM/DD/YYYY");
    setTimeFormat(settings.time_format === "24h" ? "24h" : "12h");
  }, [settings]);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !canEditPreferences) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: EASTERN_TIME_ZONE,
          language,
          date_format: dateFormat,
          time_format: timeFormat,
          theme: settings?.theme ?? "system",
          email_notifications: settings?.email_notifications ?? true,
          sms_notifications: settings?.sms_notifications ?? false,
          push_notifications: settings?.push_notifications ?? true,
          marketing_emails: settings?.marketing_emails ?? false,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }

      await refresh();
      setSaveSuccess("Preferences saved.");
      toast.success("Preferences saved.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
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
      const res = await fetch("/api/account/deactivate", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not deactivate account.");
      await supabaseBrowser.auth.signOut();
      router.replace("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not deactivate account.");
      setDeactivating(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <AccountLoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">Account</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Manage your login details and account preferences.
        </p>
      </div>

      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
        <SectionTitle>Login Information</SectionTitle>
        <div className="mt-5 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full min-w-0 sm:w-1/2">
              <FieldLabel htmlFor="account-email">Email Address</FieldLabel>
              <input id="account-email" className={FIELD} value={email} readOnly disabled />
            </div>
            <button
              type="button"
              className={BTN_SECONDARY_OUTLINE}
              style={BRAND_SECONDARY_STYLE}
              onClick={() => {
                setNextEmail(email);
                setEmailModalOpen(true);
              }}
            >
              Change Email
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full min-w-0 sm:w-1/2">
              <FieldLabel htmlFor="account-password">Password</FieldLabel>
              <input
                id="account-password"
                className={FIELD}
                value="••••••••"
                readOnly
                disabled
              />
            </div>
            <button
              type="button"
              className={BTN_SECONDARY_OUTLINE}
              style={BRAND_SECONDARY_STYLE}
              onClick={() => setPasswordModalOpen(true)}
            >
              Change Password
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 border-t border-[#E5E7EB] pt-6">
          <SectionTitle>Preferences</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {canEditPreferences && !accessLoading ? (
              <SelectField
                label="Language"
                value={language}
                onChange={(value) => setLanguage(normalizeLanguage(value))}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <label className="block">
                <FieldLabel htmlFor="account-language">Language</FieldLabel>
                <input
                  id="account-language"
                  className={FIELD}
                  value={
                    LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ??
                    "English (US)"
                  }
                  readOnly
                  disabled
                />
              </label>
            )}
            <label className="block">
              <FieldLabel htmlFor="account-timezone">Timezone</FieldLabel>
              <input
                id="account-timezone"
                className={FIELD}
                value={`(GMT-05:00) ${EASTERN_TIME_LABEL} (US & Canada)`}
                readOnly
                disabled
              />
            </label>
            {canEditPreferences && !accessLoading ? (
              <SelectField
                label="Date Format"
                value={dateFormat}
                onChange={setDateFormat}
              >
                {DATE_FORMAT_OPTIONS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </SelectField>
            ) : (
              <label className="block">
                <FieldLabel htmlFor="account-date-format">Date Format</FieldLabel>
                <input
                  id="account-date-format"
                  className={FIELD}
                  value={dateFormat}
                  readOnly
                  disabled
                />
              </label>
            )}
            {canEditPreferences && !accessLoading ? (
              <SelectField
                label="Time Format"
                value={timeFormat}
                onChange={setTimeFormat}
              >
                {TIME_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <label className="block">
                <FieldLabel htmlFor="account-time-format">Time Format</FieldLabel>
                <input
                  id="account-time-format"
                  className={FIELD}
                  value={
                    TIME_FORMAT_OPTIONS.find((option) => option.value === timeFormat)?.label ??
                    "12-hour (AM/PM)"
                  }
                  readOnly
                  disabled
                />
              </label>
            )}
          </div>
          {canEditPreferences && !accessLoading ? (
            <div className="flex justify-end">
              <button
                type="submit"
                className={BTN_PRIMARY}
                style={{ backgroundColor: "var(--brand-primary, #012352)" }}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#012352] shadow-sm">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Two-Factor Authentication (2FA)</p>
              <p className="mt-0.5 text-sm text-[#64748B]">
                Add extra layer of security to your account.
              </p>
              {mfaError ? <p className="mt-1 text-xs text-red-600">{mfaError}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 text-sm font-medium ${
                verified ? "text-emerald-600" : "text-[#64748B]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${verified ? "bg-emerald-500" : "bg-[#94A3B8]"}`}
              />
              {mfaLoading ? "Checking..." : verified ? "Enabled" : "Not enable"}
            </span>
            {verified ? (
              <button
                type="button"
                className={BTN_OUTLINE}
                disabled={mfaBusy}
                onClick={() => void turnOffAuthenticator()}
              >
                {mfaBusy ? "Working..." : "Disable 2FA"}
              </button>
            ) : (
              <button
                type="button"
                className={BTN_OUTLINE}
                disabled={mfaBusy || mfaLoading || enrolling}
                onClick={() => void startEnrollment()}
              >
                {mfaBusy ? "Starting..." : "Enable 2FA"}
              </button>
            )}
          </div>
        </div>

        {enrolling && qrSrc && secret ? (
          <form
            onSubmit={(event) => void enableAuthenticator(event)}
            className="mt-4 space-y-3 border-t border-[#E5E7EB] pt-4"
          >
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
                className={FIELD}
                value={code}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className={BTN_PRIMARY}
                style={{ backgroundColor: "var(--brand-primary, #012352)" }}
                disabled={mfaBusy || code.length !== 6}
              >
                {mfaBusy ? "Checking..." : "Confirm"}
              </button>
              <button
                type="button"
                className={BTN_OUTLINE}
                disabled={mfaBusy}
                onClick={() => void cancelEnrollment()}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#B91C1C] shadow-sm">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#7F1D1D]">Deactivate Account</p>
              <p className="mt-1 max-w-xl text-sm text-[#9F1239]">
                This will disable your account and remove your access to BrassHR. You can reactivate
                it later.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#DC2626] px-4 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-50"
            onClick={() => setDeactivateOpen(true)}
          >
            Deactivate Account
          </button>
        </div>
      </section>

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
                className={FIELD}
                value={nextEmail}
                onChange={(event) => setNextEmail(event.target.value)}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_OUTLINE}
                onClick={() => setEmailModalOpen(false)}
                disabled={emailBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={BTN_PRIMARY}
                style={{ backgroundColor: "var(--brand-primary, #012352)" }}
                disabled={emailBusy}
              >
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
            <p className="mt-1 text-sm text-[#64748B]">
              Enter and confirm a new password for this account.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <div className="relative">
                  <input
                    id="new-password"
                    type={passwordVisible ? "text" : "password"}
                    className={`${FIELD} pr-10`}
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
                    className={`${FIELD} pr-10`}
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
                className={BTN_OUTLINE}
                onClick={() => setPasswordModalOpen(false)}
                disabled={passwordBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={BTN_PRIMARY}
                style={{ backgroundColor: "var(--brand-primary, #012352)" }}
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
              You will be signed out and lose access until an administrator restores your account.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={BTN_OUTLINE}
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
