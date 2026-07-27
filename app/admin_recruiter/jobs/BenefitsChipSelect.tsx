"use client";

import { Check, Plus } from "lucide-react";
import type { ReactNode } from "react";

type BenefitsChipSelectProps = {
  options: readonly string[];
  selected: string[];
  onToggle: (benefit: string) => void;
  customBenefits?: string[];
  onRemoveCustom?: (benefit: string) => void;
  labelClassName?: string;
  headerAction?: ReactNode;
};

function benefitChipClass(selected: boolean) {
  return `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
    selected
      ? "border border-[color:var(--brand-secondary)] bg-white text-[color:var(--brand-secondary)] shadow-sm"
      : "border border-transparent bg-[#EEF2F6] text-[color:var(--brand-secondary)] hover:bg-[#E8EDF3]"
  }`;
}

export function BenefitsChipSelect({
  options,
  selected,
  onToggle,
  customBenefits = [],
  onRemoveCustom,
  labelClassName = "cursor-pointer text-sm font-normal text-[#64748B]",
  headerAction,
}: BenefitsChipSelectProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={labelClassName}>Benefits</span>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((benefit) => {
          const isSelected = selected.includes(benefit);
          const isCustom = customBenefits.includes(benefit);

          if (isCustom && onRemoveCustom) {
            return (
              <div key={benefit} className={`${benefitChipClass(isSelected)} pl-4 pr-1.5`}>
                <button
                  type="button"
                  onClick={() => onToggle(benefit)}
                  className="inline-flex cursor-pointer items-center gap-2"
                  aria-pressed={isSelected}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  )}
                  {benefit}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${benefit}`}
                  className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[color:var(--brand-secondary)] transition hover:bg-[#E8EDF3]"
                  onClick={() => onRemoveCustom(benefit)}
                >
                  ×
                </button>
              </div>
            );
          }

          return (
            <button
              key={benefit}
              type="button"
              onClick={() => onToggle(benefit)}
              className={`${benefitChipClass(isSelected)} cursor-pointer`}
              aria-pressed={isSelected}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              )}
              {benefit}
            </button>
          );
        })}
      </div>
    </div>
  );
}
