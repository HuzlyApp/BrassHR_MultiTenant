"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, type InputHTMLAttributes } from "react";

type ListTableCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  /** sm = 16px (applications table), md = 20px (candidates table) */
  size?: "sm" | "md";
  /** Native indeterminate state (header “some selected”). */
  indeterminate?: boolean;
};

const BOX_CLASS = {
  sm: "h-4 w-4 rounded-[4px]",
  /** Match login Remember Me checkbox radius (6px). */
  md: "h-5 w-5 rounded-[6px]",
} as const;

const CHECK_CLASS = {
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
} as const;

/** Table row checkbox using tenant secondary brand color when checked. */
export function ListTableCheckbox({
  className,
  size = "sm",
  indeterminate = false,
  ...props
}: ListTableCheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxClass = BOX_CLASS[size];
  const checkClass = CHECK_CLASS[size];

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <span className={`relative inline-flex shrink-0 cursor-pointer ${boxClass} ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="checkbox"
        className={`peer ${boxClass} shrink-0 cursor-pointer appearance-none border border-[#CBD5E1] bg-white transition-colors checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50`}
        {...props}
      />
      <Check
        className={`pointer-events-none absolute inset-0 m-auto hidden ${checkClass} text-white peer-checked:block`}
        strokeWidth={3}
        aria-hidden
      />
    </span>
  );
}
