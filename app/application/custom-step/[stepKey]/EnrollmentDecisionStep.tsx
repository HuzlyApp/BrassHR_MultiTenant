"use client";

import { useRef, useState } from "react";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import {
  enrollmentDecisionData,
  enrollmentQuestionForStep,
  readEnrollmentDecision,
  statusForEnrollmentDecision,
  type EnrollmentDecision,
} from "@/lib/onboarding/enrollment-decision-step";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_BTN_BACK,
  APPLICANT_BTN_PRIMARY,
} from "@/app/application/applicant-onboarding-responsive";

type UpdateStepStatus = (
  stepKey: string,
  status: OnboardingStepStatus,
  data?: Record<string, unknown>
) => Promise<void>;

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EnrollmentDecisionStep({
  step,
  required,
  updateStepStatus,
  onBack,
  onContinue,
}: {
  step: TenantOnboardingStep;
  required: boolean;
  updateStepStatus: UpdateStepStatus | undefined;
  onBack: () => void;
  onContinue: () => void;
}) {
  const onboarding = useOnboardingConfigOptional();
  const completingRef = useRef(false);
  const [saving, setSaving] = useState<EnrollmentDecision | null>(null);
  const [error, setError] = useState("");

  const question = enrollmentQuestionForStep(step);
  const progressRow = onboarding?.progress?.steps.find((row) => row.onboarding_step_id === step.id);
  const saved = progressRow ? readEnrollmentDecision(progressRow.data) : null;
  const answeredOn = formatDate(saved?.answeredAt ?? null);

  async function submit(decision: EnrollmentDecision) {
    setError("");
    setSaving(decision);
    try {
      await persistStepProgress(
        updateStepStatus,
        step.step_key,
        statusForEnrollmentDecision(decision, required),
        completingRef,
        enrollmentDecisionData(decision, question, new Date().toISOString())
      );
      if (decision === "agreed" || !required) onContinue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your response");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">{question}</p>
        {!required ? <p className="mt-1 text-xs text-slate-500">This step is optional.</p> : null}
      </div>

      {saved?.decision === "agreed" ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          You agreed{answeredOn ? ` on ${answeredOn}` : ""}. You can continue to the next step.
        </p>
      ) : saved?.decision === "not_ready" ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You answered Not ready{answeredOn ? ` on ${answeredOn}` : ""}.
          {required
            ? " This step is required, so choose Agree when you're ready to continue."
            : " You can come back and agree at any time."}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className={APPLICANT_ACTION_ROW}>
        <button type="button" onClick={onBack} className={APPLICANT_BTN_BACK}>
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving != null}
            onClick={() => void submit("not_ready")}
            className={`${APPLICANT_BTN_BACK} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving === "not_ready" ? "Saving…" : "Not Ready"}
          </button>
          <button
            type="button"
            disabled={saving != null}
            onClick={() => void submit("agreed")}
            className={`${APPLICANT_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving === "agreed" ? "Saving…" : "Agree"}
          </button>
        </div>
      </div>
    </>
  );
}
