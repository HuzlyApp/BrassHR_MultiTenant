"use client";

import { Check } from "lucide-react";

type BrandedStepperCompleteIconProps = {
  className?: string;
};

/** Completed onboarding step — filled circle with check, uses tenant primary color. */
export default function BrandedStepperCompleteIcon({
  className = "h-8 w-8",
}: BrandedStepperCompleteIconProps) {
  return (
    <span
      className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] ${className}`}
      aria-hidden
    >
      <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
    </span>
  );
}
