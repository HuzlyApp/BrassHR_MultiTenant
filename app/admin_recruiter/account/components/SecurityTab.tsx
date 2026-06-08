"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import { getAccountDisplayName } from "@/lib/account/display-name";
import { withSecurityCompleted } from "@/lib/account/completion";
import { syncAccountChecklist } from "@/lib/account/fetch-account-data";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { FIELD, FieldLabel } from "./account-form-fields";
import {
  AccountErrorBanner,
  AccountLoadingSkeleton,
  AccountSaveButton,
  AccountSuccessBanner,
} from "./AccountFormStatus";

type PasswordRules = {
  minLength: boolean;
  hasNumber: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  passwordsMatch: boolean;
};

function FieldStatusIcon({ showValid }: { showValid: boolean }) {
  const base =
    "flex h-[19.2px] w-[19.2px] shrink-0 items-center justify-center rounded-full border border-[#012352]";

  if (showValid) {
    return (
      <span className={`${base} bg-[#012352]`} aria-hidden>
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      </span>
    );
  }

  return <span className={`${base} bg-white`} aria-hidden />;
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <FieldStatusIcon showValid={met} />
      <span className={`text-sm ${met ? "text-[#012352]" : "text-[#64748B]"}`}>{label}</span>
    </li>
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
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD} flex-1`}
          autoComplete="new-password"
        />
        <FieldStatusIcon showValid={showValid} />
      </div>
    </label>
  );
}

function getPasswordRules(newPassword: string, confirmPassword: string): PasswordRules {
  return {
    minLength: newPassword.length >= 8,
    hasNumber: /\d/.test(newPassword),
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    passwordsMatch: newPassword.length > 0 && newPassword === confirmPassword,
  };
}

export default function SecurityTab() {
  const { user, profile, organization, settings, checklist, loading, error, refresh } =
    useAccountData();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const displayName = getAccountDisplayName(profile, user);
  const email = user?.email ?? profile?.email ?? "";

  const rules = useMemo(
    () => getPasswordRules(newPassword, confirmPassword),
    [newPassword, confirmPassword]
  );

  const newValid = rules.minLength && rules.hasNumber && rules.hasUpper && rules.hasLower;
  const confirmValid = confirmPassword.length > 0 && rules.passwordsMatch;
  const canSubmit = newValid && confirmValid;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || !canSubmit) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const { error: passwordError } = await supabaseBrowser.auth.updateUser({
        password: newPassword,
      });
      if (passwordError) throw passwordError;

      await syncAccountChecklist(supabaseBrowser, {
        user,
        profile,
        organization,
        settings,
        checklist: withSecurityCompleted(checklist, user.id),
      });
      await refresh();

      setNewPassword("");
      setConfirmPassword("");
      setSaveSuccess("Password updated successfully.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
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
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold leading-7 text-[#012352]">Update Password</h2>

      {error ? <AccountErrorBanner message={error} /> : null}
      {saveError ? <AccountErrorBanner message={saveError} /> : null}
      {saveSuccess ? <AccountSuccessBanner message={saveSuccess} /> : null}

      <p className="mt-2 text-sm text-[#64748B]">
        Your current session is verified. Enter a new password below — no current password required.
      </p>

      <section className="mt-4 w-full max-w-xl rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 sm:py-6">
        <div className="border-b border-[#E5E7EB] pb-5">
          <p className="text-base font-semibold text-[#012352]">{displayName}</p>
          <p className="mt-1 text-sm text-[#64748B]">{email}</p>
        </div>

        <div className="mt-5 flex flex-col gap-5">
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
        </div>

        <ul className="mt-6 flex flex-col gap-3" aria-label="Password requirements">
          <RequirementItem met={rules.minLength} label="8 or more characters" />
          <RequirementItem met={rules.hasNumber} label="At least 1 number" />
          <RequirementItem met={rules.hasUpper} label="Uppercase" />
          <RequirementItem met={rules.hasLower} label="Lowercase" />
          <RequirementItem met={rules.passwordsMatch} label="Passwords match" />
        </ul>

        <div className="mt-6 flex justify-end">
          <AccountSaveButton saving={saving} disabled={!canSubmit} label="Update Password" />
        </div>
      </section>
    </form>
  );
}
