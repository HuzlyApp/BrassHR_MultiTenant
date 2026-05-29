"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { FIELD, FieldLabel } from "./account-form-fields";

type HeaderProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PasswordRules = {
  minLength: boolean;
  hasNumber: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  passwordsMatch: boolean;
};

/** Figma: 19.2×19.2px circle, 1px #012352 border, fill #012352 when checked */
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
          autoComplete="off"
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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);

  const [currentPassword, setCurrentPassword] = useState("SecurePass1");
  const [newPassword, setNewPassword] = useState("NewPass123");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/header-data", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { profile?: HeaderProfile | null };
        if (active) setProfile(payload.profile ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    "Mark Sutton";
  const email = profile?.email || "marksutton@studiomanpower.com";

  const rules = useMemo(
    () => getPasswordRules(newPassword, confirmPassword),
    [newPassword, confirmPassword],
  );

  const currentValid = currentPassword.length > 0;
  const newValid =
    rules.minLength && rules.hasNumber && rules.hasUpper && rules.hasLower;
  const confirmValid = confirmPassword.length > 0 && rules.passwordsMatch;

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold leading-7 text-[#012352]">Update Password</h2>

      <section className="mt-4 w-full max-w-xl rounded-lg border border-[#E5E7EB] bg-white px-4 py-5 sm:px-6 sm:py-6">
        <div className="border-b border-[#E5E7EB] pb-5">
          <p className="text-base font-semibold text-[#012352]">
            {loading ? "Loading…" : displayName}
          </p>
          <p className="mt-1 text-sm text-[#64748B]">{email}</p>
        </div>

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
        </div>

        <ul className="mt-6 flex flex-col gap-3" aria-label="Password requirements">
          <RequirementItem met={rules.minLength} label="8 or more characters" />
          <RequirementItem met={rules.hasNumber} label="At least 1 number" />
          <RequirementItem met={rules.hasUpper} label="Uppercase" />
          <RequirementItem met={rules.hasLower} label="Lowercase" />
          <RequirementItem met={rules.passwordsMatch} label="Passwords match" />
        </ul>
      </section>
    </div>
  );
}
