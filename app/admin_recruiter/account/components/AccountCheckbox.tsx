"use client";

import { Check } from "lucide-react";
import type { CSSProperties, InputHTMLAttributes } from "react";

type AccountCheckboxBrand = "checkbox" | "primary" | "secondary";

type AccountCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Checked fill/border brand token. Default: checkbox → primary. */
  brand?: AccountCheckboxBrand;
};

const BRAND_VAR: Record<AccountCheckboxBrand, string> = {
  checkbox: "var(--brand-checkbox, var(--brand-primary))",
  primary: "var(--brand-primary)",
  secondary: "var(--brand-secondary)",
};

/** h-4 checkbox with tenant brand color for the checked state. */
export default function AccountCheckbox({
  className,
  brand = "checkbox",
  style,
  ...props
}: AccountCheckboxProps) {
  const fill = BRAND_VAR[brand];
  return (
    <span className={`relative inline-flex h-4 w-4 shrink-0 ${className ?? ""}`}>
      <input
        type="checkbox"
        className="peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-[#D1D5DB] bg-white transition-colors checked:border-[color:var(--account-checkbox-fill)] checked:bg-[color:var(--account-checkbox-fill)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--account-checkbox-fill)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
        style={
          {
            ["--account-checkbox-fill"]: fill,
            ...style,
          } as CSSProperties
        }
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
