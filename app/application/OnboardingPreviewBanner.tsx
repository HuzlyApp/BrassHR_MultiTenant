"use client";

import { useSearchParams } from "next/navigation";

export default function OnboardingPreviewBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("preview") !== "draft") return null;

  return (
    <div
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950"
      role="status"
    >
      Preview mode — showing unsaved builder draft. Applicants will not see these changes until you
      publish from Onboarding Builder.
    </div>
  );
}
