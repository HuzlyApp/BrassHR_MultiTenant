"use client";

import { useState } from "react";
import { BrainCircuit, ChartNoAxesCombined, ChartPie, Check, ClipboardList, Clock3, UserRoundPlus } from "lucide-react";
import { SIGNUP_INTERESTS, type SignupInterestKey, type SignupInterests } from "@/lib/signup/signup-interests";

const icons = {
  hr_data_reporting: ChartPie,
  time_attendance: Clock3,
  hiring_onboarding: UserRoundPlus,
  performance_management: ChartNoAxesCombined,
  compensation_planning: ClipboardList,
  ai_powered_hr: BrainCircuit,
};

export function LaunchPadInterests({ tenantId, initialKeys = [], onComplete, onBack }: {
  tenantId: string;
  initialKeys?: SignupInterestKey[];
  onComplete: (interests: SignupInterests) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<SignupInterestKey[]>(initialKeys);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (skipped: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/launch-pad/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: skipped ? [] : selected, skipped }),
      });
      const data = await response.json() as { tenantId?: string; interests?: SignupInterests; error?: string };
      if (!response.ok || data.tenantId !== tenantId || !data.interests?.answeredAt) {
        throw new Error(data.error ?? "Could not save your interests. Please try again.");
      }
      onComplete(data.interests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your interests. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-full w-full bg-[#F4F4F4] p-6 text-[#012352] sm:p-[30px]">
      <h1 className="text-2xl font-semibold leading-8 text-black">Goals</h1>
      <p className="mt-1 text-sm text-[#6B7280]">What brings you to brassHR? Choose what matters most, and we’ll help you hit your goals.</p>
      <form className="mt-9" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={saving}>
          <legend className="sr-only">Your signup interests. Select all that apply.</legend>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SIGNUP_INTERESTS.map(({ key, label }) => {
              const Icon = icons[key];
              const checked = selected.includes(key);
              return (
                <label key={key} className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key])}
                    className="peer sr-only"
                  />
                  <span className={`flex min-h-[84px] items-center gap-3 rounded-xl border px-5 py-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#012352] peer-focus-visible:ring-offset-2 peer-disabled:cursor-wait ${checked ? "border-[#012352] bg-[#FBF8F2]" : "border-[#E5E7EB] bg-white hover:border-[#BC8B41]"}`}>
                    <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${checked ? "border border-[#012352] bg-white text-[#012352]" : "bg-[#FBF8F2] text-[#BC8B41]"}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-black">{label}</span>
                    <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[#012352] bg-[#012352] text-white" : "border-[#CBD5E1]"}`}>
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <button type="button" disabled={saving} onClick={() => { void save(true); }} className="text-sm font-semibold disabled:opacity-60">Skip for now</button>
          <div className="flex items-center gap-4">
            <button type="button" disabled={saving} onClick={onBack} className="rounded-lg border border-[#012352] bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60">Back</button>
            <button type="submit" disabled={saving || selected.length === 0} className="rounded-lg bg-[#012352] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save & Continue"}</button>
          </div>
        </div>
      </form>
    </section>
  );
}
