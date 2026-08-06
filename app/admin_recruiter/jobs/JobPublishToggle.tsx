"use client";

import { Check } from "lucide-react";

type JobPublishToggleProps = {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onChange: () => void;
  /** Tenant secondary brand color when published (active). */
  activeColor?: string;
};

/** Figma publish/unpublish toggle — active uses tenant secondary color. */
export default function JobPublishToggle({
  checked,
  disabled = false,
  busy = false,
  onChange,
  activeColor = "var(--brand-secondary)",
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "" : "bg-[#E2E8F0]"
      }`}
      style={checked ? { backgroundColor: activeColor } : undefined}
      aria-label={checked ? "Unpublish job" : "Publish job"}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      >
        {checked ? (
          <Check className="h-3 w-3" strokeWidth={3} style={{ color: activeColor }} aria-hidden />
        ) : null}
      </span>
    </button>
  );
}
