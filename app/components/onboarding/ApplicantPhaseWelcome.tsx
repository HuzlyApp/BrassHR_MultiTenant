"use client";

import { useEffect, useState } from "react";
import type { ApplicantLifecyclePhase } from "@/lib/onboarding/workflow-phase";

type Props = {
  phase: ApplicantLifecyclePhase;
  applicationId?: string | null;
};

export default function ApplicantPhaseWelcome({ phase, applicationId }: Props) {
  const storageKey = `brasshr.postHireWelcome.${applicationId || "session"}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (phase !== "post_hire") {
      setVisible(false);
      return;
    }
    try {
      setVisible(window.sessionStorage.getItem(storageKey) !== "1");
    } catch {
      setVisible(true);
    }
  }, [phase, storageKey]);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-slate-800">
      <p className="text-base font-semibold">Congratulations!</p>
      <p className="mt-1 text-sm text-slate-700">
        Your placement has been accepted. Let&apos;s complete your onboarding requirements so
        you&apos;re ready for your start date.
      </p>
      <button
        type="button"
        className="mt-3 rounded-lg bg-[color:var(--brand-primary,#012352)] px-4 py-2 text-sm font-semibold text-white"
        onClick={() => {
          try {
            window.sessionStorage.setItem(storageKey, "1");
          } catch {
            // Ignore storage failures; the banner can reappear this session.
          }
          setVisible(false);
        }}
      >
        Start Onboarding
      </button>
    </div>
  );
}
