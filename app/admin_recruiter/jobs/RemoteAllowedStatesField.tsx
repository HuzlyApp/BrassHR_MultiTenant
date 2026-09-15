"use client";

import { getStateNameFromCode, US_STATE_NAME_TO_CODE } from "@/lib/us-state-names";
import { JOB_FORM_LABEL_CLASS } from "./job-form-shared";
import { JobFormRequiredMark } from "./JobFormRequiredMark";

export function formatRemoteAllowedStatesLabel(states: string[] | null | undefined): string {
  if (!states?.length) return "";
  return states
    .map((code) => getStateNameFromCode(code) ?? code)
    .filter(Boolean)
    .join(", ");
}

export function showsRemoteAllowedStatesField(locationType: string | null | undefined): boolean {
  return Boolean(locationType?.toLowerCase().includes("remote"));
}

export function RemoteAllowedStatesField({
  value,
  error,
  onChange,
  required = false,
}: {
  value: string[];
  error?: string;
  onChange: (next: string[]) => void;
  required?: boolean;
}) {
  const selected = new Set(value);
  return (
    <div className="min-[700px]:col-span-2">
      <p className={JOB_FORM_LABEL_CLASS}>
        Remote work allowed in
        {required ? <JobFormRequiredMark /> : null}
      </p>
      <p className="mb-2 text-xs text-[#64748B]">
        Select every state where this role can be worked. There is no United States shortcut.
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(US_STATE_NAME_TO_CODE).map(([name, code]) => {
          const checked = selected.has(code);
          return (
            <button
              key={code}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                checked
                  ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[#1D2739]"
                  : "border-[#CBD5E1] bg-white text-[#64748B]"
              }`}
              onClick={() => {
                const next = new Set(selected);
                if (checked) next.delete(code);
                else next.add(code);
                onChange(Array.from(next));
              }}
            >
              {name}
            </button>
          );
        })}
      </div>
      {error ? <span className="mt-1 block text-sm text-rose-600">{error}</span> : null}
    </div>
  );
}
