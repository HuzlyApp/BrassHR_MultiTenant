"use client";

import { Check } from "lucide-react";

type JobPublishToggleProps = {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  /** Tenant secondary brand color when published (active). */
  activeColor?: string;
  ariaLabel?: string;
};

/**
 * Figma Actions-column toggle: 28×16 track, 2px inset, 12px thumb.
 * Pixel sizes + absolute thumb avoid rem/subpixel clipping at browser zoom (e.g. 80%).
 * Also used for Highlight Multi-Job Applicants.
 */
export default function JobPublishToggle({
  checked,
  disabled = false,
  busy = false,
  onChange,
  activeColor = "var(--brand-secondary)",
  ariaLabel,
}: JobPublishToggleProps) {
  const isDisabled = disabled || busy;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy}
      disabled={isDisabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!isDisabled) onChange();
      }}
      className={`relative box-border inline-block h-[16px] w-[28px] min-h-[16px] min-w-[28px] shrink-0 overflow-visible rounded-full border-0 p-0 align-middle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "" : "bg-[#E2E8F0]"
      }`}
      style={checked ? { backgroundColor: activeColor } : undefined}
      aria-label={ariaLabel ?? (checked ? "Unpublish job" : "Publish job")}
    >
      <span
        className="pointer-events-none absolute top-[2px] left-[2px] box-border flex h-[12px] w-[12px] items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-150 ease-out"
        style={{ transform: checked ? "translateX(12px)" : "translateX(0)" }}
        aria-hidden
      >
        {checked ? (
          <Check
            className="h-[8px] w-[8px] shrink-0"
            strokeWidth={3}
            style={{ color: activeColor }}
            aria-hidden
          />
        ) : null}
      </span>
    </button>
  );
}
