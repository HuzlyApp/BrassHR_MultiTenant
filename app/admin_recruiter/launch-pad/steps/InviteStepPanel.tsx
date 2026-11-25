"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import { PERSON_NAME_MAX_LENGTH } from "@/lib/person-name";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

const INVITE_ROLE_OPTIONS = [
  { value: "recruiter", label: "Recruiter" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function InviteStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("recruiter");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (saving) return;

    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedEmail) {
      setError("Email is required. Use Skip if you want to invite teammates later.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!trimmedFirst) {
      setError("First name is required.");
      return;
    }
    if (!trimmedLast) {
      setError("Last name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
          role,
          requirePasswordChange: true,
          origin: window.location.origin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send invite");
        return;
      }
      toast.success("Invite sent.");
      onComplete();
    } catch {
      setError("Could not send invite. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full justify-center py-8">
      <div className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold leading-7 text-black" style={interStyle}>
              Invite Team
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Add an HR or manager. Use Skip if you want to do this later.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "First name", value: firstName, setValue: setFirstName, autoComplete: "given-name" },
              { label: "Last name", value: lastName, setValue: setLastName, autoComplete: "family-name" },
            ].map((field) => (
              <label key={field.label} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
                  {field.label} <span className="text-[#DC2626]">*</span>
                </span>
                <input
                  type="text"
                  autoComplete={field.autoComplete}
                  maxLength={PERSON_NAME_MAX_LENGTH}
                  required
                  value={field.value}
                  onChange={(e) => field.setValue(e.target.value)}
                  className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
                  style={interStyle}
                />
              </label>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Email <span className="text-[#DC2626]">*</span>
            </span>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
              style={interStyle}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Role
            </span>
            <SettingsSelect
              aria-label="Role"
              value={role}
              options={INVITE_ROLE_OPTIONS}
              onChange={setRole}
              size="sm"
              className="w-full"
              triggerClassName="h-9 w-full justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 pr-3 text-[14px] text-black hover:bg-white focus-visible:border-[color:var(--brand-secondary)] focus-visible:outline-none"
            />
          </div>

          {error ? (
            <p role="alert" className="text-[12px] text-[#DC2626]" style={interStyle}>
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[#E5E7EB]">
          <LaunchPadStepActions
            onSkip={onSkip}
            onBack={onBack}
            onContinue={() => void handleContinue()}
            saving={saving}
            continueLabel="Send Invite"
          />
        </div>
      </div>
    </div>
  );
}
