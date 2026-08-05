"use client";

import { Check, Loader2 } from "lucide-react";

/** Figma Brand Huzly/500 — Main (fixed; not tenant branding). */
export const JOB_PUBLISH_TOGGLE_ACTIVE_COLOR = "#104B83";

type JobPublishToggleProps = {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
  ariaLabel: string;
};

/**
 * Figma switch — active track uses Brand Huzly/500; inactive track is neutral gray.
 */
export default function JobPublishToggle({
  checked,
  disabled = false,
  busy = false,
  onToggle,
  ariaLabel,
}: JobPublishToggleProps) {
  const isDisabled = disabled || busy;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={isDisabled}
      onClick={onToggle}
      className="relative inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: checked ? JOB_PUBLISH_TOGGLE_ACTIVE_COLOR : "#E4E7EC",
      }}
    >
      <span
        className="absolute top-[2px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow-sm transition-all"
        style={{ left: checked ? 20 : 2 }}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-[#94A3B8]" aria-hidden />
        ) : checked ? (
          <Check
            className="h-3 w-3"
            strokeWidth={3}
            style={{ color: JOB_PUBLISH_TOGGLE_ACTIVE_COLOR }}
            aria-hidden
          />
        ) : null}
      </span>
    </button>
  );
}
