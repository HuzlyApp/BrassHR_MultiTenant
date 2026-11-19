"use client";

import { useState } from "react";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

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
  const [role, setRole] = useState("recruiter");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      if (email.trim()) {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
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
      }
      onComplete();
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
              Add an HR or manager. You can do this later.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
              style={interStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
              style={interStyle}
            >
              <option value="recruiter">Recruiter</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
            </select>
          </label>

          {error ? (
            <p className="text-[12px] text-[#DC2626]" style={interStyle}>
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
            continueLabel={email.trim() ? "Send Invite" : "Save & Continue"}
          />
        </div>
      </div>
    </div>
  );
}
