"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import OnboardingStepper from "@/app/components/OnboardingStepper";
import OnboardingPreviewBanner from "@/app/application/OnboardingPreviewBanner";
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav";
import {
  getWorkflowSettings,
  workflowSettingsAdminHints,
} from "@/lib/onboarding/workflow-settings";
import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";
import type { OnboardingStepType } from "@/lib/onboarding/types";

export default function CustomOnboardingStepPage() {
  const params = useParams();
  const stepKey = decodeURIComponent(String(params?.stepKey ?? "")).trim();
  const nav = useOnboardingStepNav();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const step = useMemo(() => {
    return nav.enabledSteps?.find((s) => s.step_key === stepKey) ?? null;
  }, [nav.enabledSteps, stepKey]);

  const settings = step ? getWorkflowSettings(step) : null;
  const adminHints = step ? workflowSettingsAdminHints(step) : [];

  const typedRoute =
    step &&
    routeForOnboardingStep(step.step_key, step.step_type as OnboardingStepType);

  const isGenericCustom =
    step?.step_type === "custom_question" &&
    typedRoute?.includes(`/application/custom-step/${encodeURIComponent(stepKey)}`);

  async function handleComplete() {
    if (!step) return;
    setError("");
    if (settings?.required && !answer.trim()) {
      setError("This step is required. Enter a response before continuing.");
      return;
    }
    setSaving(true);
    try {
      await nav.updateStepStatus?.(step.step_key, "completed", {
        response: answer.trim(),
        step_type: step.step_type,
      });
      nav.goNext();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSaving(false);
    }
  }

  if (!nav.configLoading && !step) {
    return (
      <OnboardingLayout>
        <OnboardingPreviewBanner />
        <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Step not found</p>
          <p className="mt-2">
            The step &quot;{stepKey}&quot; is not part of this tenant&apos;s published onboarding
            flow.
          </p>
        </div>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout>
      <OnboardingPreviewBanner />
      <OnboardingStepper title={step?.title ?? "Custom step"} />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">{step?.title ?? "Custom step"}</h1>
        {step?.description ? (
          <p className="mt-2 text-sm text-slate-600">{step.description}</p>
        ) : null}

        {settings?.provider?.trim() ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold">Instructions: </span>
            Complete this step{settings.provider ? ` (${settings.provider})` : ""}.
            {settings.timeline ? ` Expected timeline: ${settings.timeline}.` : ""}
          </p>
        ) : null}

        {adminHints.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
            {adminHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}

        {isGenericCustom ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-800" htmlFor="custom-answer">
              Your response {settings?.required ? <span className="text-red-600">*</span> : null}
            </label>
            <textarea
              id="custom-answer"
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Enter information for this step"
            />
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-600">
            This step uses a dedicated application screen. Use Continue to open the correct page.
          </p>
        )}

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => nav.goPrev()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (isGenericCustom) {
                void handleComplete();
                return;
              }
              if (typedRoute) {
                nav.push(typedRoute);
              }
            }}
            className="rounded-lg bg-[#0d9488] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : isGenericCustom ? "Save & continue" : "Continue"}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
