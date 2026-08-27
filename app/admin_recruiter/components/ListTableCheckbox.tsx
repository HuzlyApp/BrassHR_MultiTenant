"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, type InputHTMLAttributes, type MouseEvent } from "react";

type ListTableCheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  /** sm = 16px (applications table), md = 20px (candidates table) */
  size?: "sm" | "md";
  indeterminate?: boolean;
};

const BOX_CLASS = {
  sm: "h-4 w-4 rounded-[4px]",
  md: "h-5 w-5 rounded-[5px]",
} as const;

const CHECK_CLASS = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
} as const;

/** Table row checkbox using tenant secondary brand color when checked. */
export function ListTableCheckbox({
  className,
  size = "sm",
  indeterminate = false,
  onClick,
  checked,
  disabled,
  ...props
}: ListTableCheckboxProps) {
  const boxClass = BOX_CLASS[size];
  const checkClass = CHECK_CLASS[size];
  const inputRef = useRef<HTMLInputElement>(null);
  const showIndeterminate = Boolean(indeterminate) && !checked;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = showIndeterminate;
    }
  }, [showIndeterminate]);

  return (
    <span
      className={`relative inline-flex shrink-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"} ${boxClass} ${className ?? ""}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className={`peer ${boxClass} shrink-0 appearance-none border border-[#CBD5E1] bg-white transition-colors checked:border-[color:var(--brand-secondary)] checked:bg-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 ${disabled ? "" : "cursor-pointer"} ${showIndeterminate ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]" : ""}`}
        onClick={(event: MouseEvent<HTMLInputElement>) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        {...props}
      />
      {showIndeterminate ? (
        <span
          className="pointer-events-none absolute inset-0 m-auto h-0.5 w-2.5 rounded-full bg-white"
          aria-hidden
        />
      ) : (
        <Check
          className={`pointer-events-none absolute inset-0 m-auto hidden ${checkClass} text-white peer-checked:block`}
          strokeWidth={3}
          aria-hidden
        />
      )}
    </span>
  );
}
