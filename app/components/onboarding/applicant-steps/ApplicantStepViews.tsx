"use client";

import type { PublishedWorkflowStep, ApplicantStepStatus } from "@/lib/onboarding/applicant-workflow-types";

type StepProps = {
  step: PublishedWorkflowStep;
  status?: ApplicantStepStatus | null;
};

export function SkillAssessmentStep({ step }: StepProps) {
  return (
    <section aria-label={step.title}>
      <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
      {step.description ? (
        <p className="mt-2 text-sm text-slate-600">{step.description}</p>
      ) : null}
      <p className="mt-4 text-sm text-slate-500">Complete the skill and qualification assessment.</p>
    </section>
  );
}

export function DocumentUploadStep({ step }: StepProps) {
  return (
    <section aria-label={step.title}>
      <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
      {step.description ? (
        <p className="mt-2 text-sm text-slate-600">{step.description}</p>
      ) : null}
      <p className="mt-4 text-sm text-slate-500">Upload the required documents for this step.</p>
    </section>
  );
}

function providerLabel(provider: unknown): string {
  if (typeof provider !== "string" || !provider.trim()) return "Provider";
  return provider.toLowerCase() === "checker" ? "Checker" : provider;
}

function formatProviderStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function BackgroundCheckStep({ step, status }: StepProps) {
  const provider = status?.metadata?.provider ?? step.settings.provider;
  const providerStatus =
    typeof status?.metadata?.providerStatus === "string"
      ? status.metadata.providerStatus
      : status?.status === "failed"
        ? "failed"
        : status?.status === "waiting_for_candidate"
          ? "waiting_for_candidate"
          : null;

  const clientPerforms = step.settings.clientPerforms !== false;
  const notifyHrOnFail =
    status?.metadata?.notifyHrOnFail === true || step.settings.notifyHrOnFail === true;
  const failed = providerStatus === "failed" || status?.status === "failed";

  return (
    <section aria-label={step.title}>
      <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
      {step.description ? (
        <p className="mt-2 text-sm text-slate-600">{step.description}</p>
      ) : null}

      {provider ? (
        <p className="mt-4 text-sm text-slate-700">
          Provider: <span className="font-medium">{providerLabel(provider)}</span>
        </p>
      ) : null}

      {providerStatus ? (
        <p className="mt-2 text-sm text-slate-600 capitalize">
          Status: {formatProviderStatus(providerStatus)}
        </p>
      ) : null}

      {clientPerforms ? (
        <p className="mt-4 text-sm text-slate-600">
          Your background check is being handled by the hiring team.
        </p>
      ) : null}

      {failed ? (
        <p className="mt-4 text-sm font-medium text-rose-700">
          Background check failed. HR has been notified.
        </p>
      ) : null}

      {failed && notifyHrOnFail ? (
        <p className="mt-1 text-xs text-slate-500">HR has been notified about this result.</p>
      ) : null}
    </section>
  );
}

export function ReferenceVerificationStep({ step }: StepProps) {
  return (
    <section aria-label={step.title}>
      <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
      {step.description ? (
        <p className="mt-2 text-sm text-slate-600">{step.description}</p>
      ) : null}
      <p className="mt-4 text-sm text-slate-500">Add professional references for verification.</p>
    </section>
  );
}

export function UnsupportedStepFallback({ step }: StepProps) {
  return (
    <section aria-label={step.title}>
      <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
      <p className="mt-4 text-sm text-slate-600">
        This onboarding step is configured but does not yet have an applicant-facing screen.
      </p>
    </section>
  );
}
