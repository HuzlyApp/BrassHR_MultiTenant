"use client";

import { Check, Plus } from "lucide-react";
import { JOB_FORM_JOB_TYPES } from "./job-form-shared";

type JobTypeChipSelectProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  labelClassName?: string;
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="mt-1 block text-xs text-rose-600">{error}</span>;
}

export function JobTypeChipSelect({
  value,
  onChange,
  error,
  labelClassName = "mb-1.5 block cursor-pointer text-sm font-normal text-[#64748B]",
}: JobTypeChipSelectProps) {
  const selected = value.trim();

  return (
    <div>
      <span className={labelClassName}>
        Job type <span className="text-[#EF4444]">*</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {JOB_FORM_JOB_TYPES.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                isSelected
                  ? "border border-[color:var(--brand-secondary)] bg-white text-[color:var(--brand-secondary)] shadow-sm"
                  : "border border-transparent bg-[#EEF2F6] text-[color:var(--brand-secondary)] hover:bg-[#E8EDF3]"
              }`}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
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
