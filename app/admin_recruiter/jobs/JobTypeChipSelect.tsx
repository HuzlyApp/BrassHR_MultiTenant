"use client";

import { Check, Plus } from "lucide-react";
import {
  JOB_FORM_JOB_TYPES,
  parseJobFormJobTypes,
  toggleJobFormJobType,
} from "./job-form-shared";
import { JobFormRequiredMark } from "./JobFormRequiredMark";

type JobTypeChipSelectProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  labelClassName?: string;
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="mt-1 block text-sm text-rose-600">{error}</span>;
}

export function JobTypeChipSelect({
  value,
  onChange,
  error,
  label = "Employment Type",
  labelClassName = "mb-1.5 block cursor-pointer text-sm font-normal text-[#64748B]",
}: JobTypeChipSelectProps) {
  const selected = new Set(parseJobFormJobTypes(value));

  return (
    <div>
      <span className={labelClassName}>
        {label}
        <JobFormRequiredMark />
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {JOB_FORM_JOB_TYPES.map((option) => {
          const isSelected = selected.has(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(toggleJobFormJobType(value, option))}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                isSelected
                  ? "border border-[color:var(--brand-secondary)] bg-white text-[#1D2739] shadow-sm"
                  : "border border-transparent bg-[#EEF2F6] text-[#1D2739] hover:bg-[#E8EDF3]"
              }`}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : (
                <Plus
                  className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand-secondary)]"
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
              {option}
            </button>
          );
        })}
      </div>
      <FieldError error={error} />
    </div>
  );
}
