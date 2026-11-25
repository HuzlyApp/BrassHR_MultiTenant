"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAccountData } from "@/app/admin_recruiter/hooks/useAccountData";
import SettingsSelect from "@/app/admin_recruiter/settings/SettingsSelect";
import { COMPANY_SIZE_OPTIONS } from "@/app/tenant-onboarding/constants";
import { interStyle } from "../constants";
import { LaunchPadStepActions } from "../LaunchPadStepHeader";

const EMPLOYEE_COUNT_OPTIONS = COMPANY_SIZE_OPTIONS.map((size) => ({
  value: size,
  label: size,
}));

export function OrgDetailsStepPanel({
  onBack,
  onSkip,
  onComplete,
}: {
  onBack: () => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const { organization, refresh } = useAccountData();
  const [address, setAddress] = useState("");
  const [ein, setEin] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAddress(organization?.address_line_1 ?? "");
    setEin(organization?.ein ?? "");
    setCompanySize(organization?.company_size ?? "");
  }, [organization?.id, organization?.address_line_1, organization?.ein, organization?.company_size]);

  const handleContinue = async () => {
    const trimmedAddress = address.trim();
    const trimmedEin = ein.trim();
    if (!trimmedAddress || !trimmedEin || !companySize) {
      setError("Address, EIN, and employee count are required. Use Skip if you want to finish this later.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/launch-pad/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: trimmedAddress,
          ein: trimmedEin,
          companySize,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ??
            "Could not save yet. Finish remaining company fields in Settings, or skip for now."
        );
        return;
      }
      await refresh();
      toast.success("Organization details saved.");
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save organization details.");
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
              Organization Details
            </h2>
            <p className="text-[12px] font-normal leading-4 text-[#6B7280]" style={interStyle}>
              Full address, EIN, employee count. Use Skip if you want to finish this later.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Address <span className="text-[#DC2626]">*</span>
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              required
              className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
              style={interStyle}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              EIN <span className="text-[#DC2626]">*</span>
            </span>
            <input
              value={ein}
              onChange={(e) => setEin(e.target.value)}
              placeholder="XX-XXXXXXX"
              required
              className="h-9 rounded-lg border border-[#E5E7EB] px-3 text-[14px] outline-none focus:border-[#012352]"
              style={interStyle}
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-normal leading-4 text-black" style={interStyle}>
              Employee count <span className="text-[#DC2626]">*</span>
            </span>
            <SettingsSelect
              aria-label="Employee count"
              value={companySize}
              options={EMPLOYEE_COUNT_OPTIONS}
              onChange={setCompanySize}
              placeholder="Select size"
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
          />
        </div>
      </div>
    </div>
  );
}
