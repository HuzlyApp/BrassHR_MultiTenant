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
  isApplicantWaitingGateStep,
  isIntegrationPartnerStep,
  showsApplicantPartnerScreeningNotice,
} from "@/lib/onboarding/workflow-settings";
import { dedicatedRouteForWorkflowStep } from "@/lib/onboarding/resolve-applicant-step-route";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { resolveCustomStepContinue } from "@/lib/onboarding/custom-step-continue";
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_BTN_BACK,
  APPLICANT_BTN_PRIMARY,
  APPLICANT_CONTENT_CLASS,
  APPLICANT_HEADER_ROW,
  APPLICANT_SHELL_CLASS,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive";

export default function CustomOnboardingStepPage() {
  const branding = useTenantBranding();
  const contentStyle = brandingToCssVars(branding) as CSSProperties;
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
  const partnerLabel = step ? integrationProviderLabel(step) : null;
  const usesPartner = step ? isIntegrationPartnerStep(step) : false;
  const waitingGate = step ? isApplicantWaitingGateStep(step) : false;
  const showScreeningNotice = step ? showsApplicantPartnerScreeningNotice(step) : false;

  const isGenericCustom =
    step?.step_type === "custom_question" &&
    !usesPartner &&
    (typeof step.metadata?.workflow_step_id !== "string" ||
      step.metadata.workflow_step_id === "custom-step" ||
      step.metadata.workflow_step_id === "custom-form");

  const shouldRedirectToDedicatedScreen = useMemo(() => {
    if (!step || showCustomForm) return false;
    if (step.step_type !== "custom_question") return true;
    const dedicated = dedicatedRouteForWorkflowStep(step);
    const customPath = APPLICATION_ROUTES.customStep(step.step_key).split("?")[0];
    return Boolean(dedicated && dedicated !== customPath);
  }, [step, showCustomForm]);

  useMarkStepInProgressIfPending({
    step,
    disabled: nav.configLoading || !step,
    updateStepStatus: nav.updateStepStatus,
    completingRef,
  });

  async function handleComplete() {
    if (!step) return;
    setError("");
    if (waitingGate) {
      nav.goNext();
      return;
    }
    const formVisible = isGenericCustom || showCustomForm;
    const decision = resolveCustomStepContinue({
      formVisible,
      required: settings?.required === true,
      answer,
    });
    if (decision.action === "require-answer") {
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
          response: decision.response,
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
        <div className={`${APPLICANT_SHELL_CLASS} justify-center`} style={contentStyle}>
          <div className="mx-auto max-w-lg text-center text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Step not found</p>
            <p className="mt-2">
              The step &quot;{stepKey}&quot; is not part of this tenant&apos;s onboarding workflow.
            </p>
          </div>
        </div>
      </OnboardingLayout>
    );
  }

  if (step && shouldRedirectToDedicatedScreen) {
    return (
      <ApplicantWorkflowStepRedirect
        step={step}
        onStayOnCustomPage={() => setShowCustomForm(true)}
      />
    );
  }

  const pageTitle = step?.title?.trim() || "Onboarding step";

  return (
    <OnboardingLayout>
      <div className={APPLICANT_SHELL_CLASS} style={contentStyle}>
        <OnboardingStepper />

        <div className={APPLICANT_CONTENT_CLASS}>
          <div className={APPLICANT_HEADER_ROW}>
            <h2 className={APPLICANT_TITLE_CLASS}>{pageTitle}</h2>
          </div>

          {step?.description ? (
            <p className="text-sm text-slate-600">{step.description}</p>
          ) : null}

          {waitingGate ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Your recruiter or HR team completes this approval. Continue does not unlock the next
              stage — you will get an email when they accept your placement.
            </p>
          ) : showScreeningNotice && partnerLabel ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Your background screening is handled by {partnerLabel}.
              {settings?.timeline ? ` Typical turnaround: ${settings.timeline}.` : ""}
            </p>
          ) : settings && !usesPartner ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {settings.clientPerforms
                ? "Complete this step in the application."
                : "Your recruiter or HR team will complete this step on your behalf."}
              {settings.timeline ? ` Expected timeline: ${settings.timeline}.` : ""}
              {!settings.required ? " This step is optional." : null}
            </p>
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

          <div className={APPLICANT_ACTION_ROW}>
            <button
              type="button"
              onClick={() => nav.goPrev()}
              className={APPLICANT_BTN_BACK}
            >
              Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void handleComplete();
              }}
              className={`${APPLICANT_BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {saving
                ? "Saving…"
                : waitingGate
                  ? "View application status"
                  : isGenericCustom || showCustomForm
                    ? "Save & continue"
                    : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
