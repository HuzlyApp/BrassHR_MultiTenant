"use client";

import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import OnboardingStepper from "@/app/components/OnboardingStepper";
import ApplicantWorkflowStepRedirect from "@/app/components/onboarding/ApplicantWorkflowStepRedirect";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav";
import {
  persistStepProgress,
  useMarkStepInProgressIfPending,
} from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import {
  getWorkflowSettings,
  integrationProviderLabel,
  isIntegrationPartnerStep,
  workflowSettingsAdminHints,
} from "@/lib/onboarding/workflow-settings";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";

export default function CustomOnboardingStepPage() {
  const branding = useTenantBranding();
  const contentStyle = brandingToCssVars(branding) as CSSProperties;
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties;
  const params = useParams();
  const stepKey = decodeURIComponent(String(params?.stepKey ?? "")).trim();
  const nav = useOnboardingStepNav();
  const completingRef = useRef(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const step = useMemo(() => {
    return nav.enabledSteps?.find((s) => s.step_key === stepKey) ?? nav.currentStep ?? null;
  }, [nav.enabledSteps, nav.currentStep, stepKey]);

  const settings = step ? getWorkflowSettings(step) : null;
  const adminHints = step ? workflowSettingsAdminHints(step) : [];
  const partnerLabel = step ? integrationProviderLabel(step) : null;
  const usesPartner = step ? isIntegrationPartnerStep(step) : false;

  const isGenericCustom =
    step?.step_type === "custom_question" &&
    !usesPartner &&
    (typeof step.metadata?.workflow_step_id !== "string" ||
      step.metadata.workflow_step_id === "custom-step" ||
      step.metadata.workflow_step_id === "custom-form");

  useMarkStepInProgressIfPending({
    step,
    disabled: nav.configLoading || !step,
    updateStepStatus: nav.updateStepStatus,
    completingRef,
  });

  async function handleComplete() {
    if (!step) return;
    setError("");
    if (settings?.required && !answer.trim()) {
      setError("This step is required. Enter a response before continuing.");
      return;
    }
    setSaving(true);
    try {
      await persistStepProgress(
        nav.updateStepStatus,
        step.step_key,
        "completed",
        completingRef,
        {
          response: answer.trim(),
          step_type: step.step_type,
        }
      );
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
        <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Step not found</p>
          <p className="mt-2">
            The step &quot;{stepKey}&quot; is not part of this tenant&apos;s onboarding workflow.
          </p>
        </div>
      </OnboardingLayout>
    );
  }

  if (step && !showCustomForm && step.step_type !== "custom_question") {
    return (
      <ApplicantWorkflowStepRedirect
        step={step}
        onStayOnCustomPage={() => setShowCustomForm(true)}
      />
    );
  }

  return (
    <OnboardingLayout>
      <OnboardingStepper title={step?.title ?? "Onboarding step"} />
      <div className="mx-auto max-w-2xl px-4 py-8" style={contentStyle}>
        <h1 className="text-xl font-semibold text-slate-900">{step?.title ?? "Onboarding step"}</h1>
        {step?.description ? (
          <p className="mt-2 text-sm text-slate-600">{step.description}</p>
        ) : null}

        {settings ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold">Instructions: </span>
            {usesPartner && partnerLabel
              ? `This step is completed via ${partnerLabel}.`
              : settings.clientPerforms
                ? "Complete this step in the application."
                : "Your recruiter or HR team will complete this step on your behalf."}
            {settings.timeline ? ` Expected timeline: ${settings.timeline}.` : ""}
            {!settings.required ? " This step is optional." : null}
          </p>
        ) : null}

        {adminHints.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
            {adminHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        ) : null}

        {isGenericCustom || showCustomForm ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-800" htmlFor="custom-answer">
              Your response {settings?.required ? <span className="text-red-600">*</span> : null}
            </label>
            <textarea
              id="custom-answer"
              rows={5}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[color:var(--brand-primary)]"
              placeholder="Enter information for this step"
            />
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-600">
            This step uses a dedicated application screen in your onboarding workflow.
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
              if (isGenericCustom || showCustomForm) {
                void handleComplete();
                return;
              }
              if (step) {
                const route = APPLICATION_ROUTES.customStep(step.step_key);
                nav.push(route);
              }
            }}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:brightness-90 disabled:opacity-50"
            style={primaryBtnStyle}
          >
            {saving ? "Saving…" : isGenericCustom || showCustomForm ? "Save & continue" : "Continue"}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
