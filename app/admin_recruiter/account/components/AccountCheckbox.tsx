"use client";

import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";

type AccountCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** h-4 checkbox with tenant checkbox color (--brand-checkbox), falling back to primary. */
export default function AccountCheckbox({ className, ...props }: AccountCheckboxProps) {
  return (
    <span className={`relative inline-flex h-4 w-4 shrink-0 ${className ?? ""}`}>
      <input
        type="checkbox"
        className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-[#D1D5DB] bg-white transition-colors checked:border-(--brand-checkbox,var(--brand-primary)) checked:bg-(--brand-checkbox,var(--brand-primary)) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand-checkbox,var(--brand-primary))_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto hidden h-2.5 w-2.5 text-white peer-checked:block"
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );
}
