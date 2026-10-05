"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import { skipOnboardingStep } from "@/lib/onboarding/skip-onboarding-step";
import { isOnboardingStepSkippable } from "@/lib/onboarding/is-step-skippable";
import { stepUsesFirmaSigning } from "@/lib/onboarding/firma-step-settings";
import { useApplicantSigningEmail } from "@/lib/onboarding/use-applicant-signing-email";
import {
  buildPostHireSubmissionData,
  readPostHireScreenContent,
  readPostHireSubmission,
  type PostHireScreenKind,
  type PostHireSubmissionField,
} from "@/lib/onboarding/post-hire-step-screens";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";
import { ActionRow, formatSubmittedDate, Section, type ActionRowProps } from "./fields";
import AcknowledgmentForm from "./AcknowledgmentForm";
import DirectDepositForm from "./DirectDepositForm";
import FirmaSignedForm from "./FirmaSignedForm";
import I9AttestationForm from "./I9AttestationForm";
import StepContent from "./StepContent";
import TaxWithholdingForm from "./TaxWithholdingForm";

type UpdateStepStatus = (
  stepKey: string,
  status: OnboardingStepStatus,
  data?: Record<string, unknown>
) => Promise<void>;

const FIRMA_CAPABLE_KINDS: ReadonlySet<PostHireScreenKind> = new Set([
  "tax_withholding",
  "i9_attestation",
  "acknowledgment",
]);

export default function PostHireStepScreen({
  step,
  kind,
  tenantSlug,
  updateStepStatus,
  onBack,
  onContinue,
}: {
  step: TenantOnboardingStep;
  kind: PostHireScreenKind;
  tenantSlug: string | null;
  updateStepStatus: UpdateStepStatus | undefined;
  onBack: () => void;
  onContinue: () => void;
}) {
  const onboarding = useOnboardingConfigOptional();
  const applicantId = onboarding?.applicantId ?? null;
  const completingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const signer = useApplicantSigningEmail({ applicantId, tenantSlug });

  const progressRows = onboarding?.progress?.steps ?? [];
  const progressRow =
    progressRows.find((row) => row.onboarding_step_id === step.id) ??
    progressRows.find((row) => row.step_key === step.step_key);
  const submission = progressRow ? readPostHireSubmission(progressRow.data) : null;
  const done = progressRow?.status === "completed";
  const content = readPostHireScreenContent(step);
  const usesFirma = FIRMA_CAPABLE_KINDS.has(kind) && stepUsesFirmaSigning(step);
  const fullName = `${signer.firstName} ${signer.lastName}`.trim();

  async function submit(fields: PostHireSubmissionField[], extra?: Record<string, unknown>) {
    await persistStepProgress(updateStepStatus, step.step_key, "completed", completingRef, {
      ...extra,
      ...buildPostHireSubmissionData(kind, fields),
      step_type: step.step_type,
    });
    setEditing(false);
    onContinue();
  }

  const actions: ActionRowProps = {
    onBack,
    onSkip:
      !done && isOnboardingStepSkippable(step)
        ? () => void skipOnboardingStep({ step, updateStepStatus, completingRef, onNavigate: onContinue })
        : undefined,
  };

  const showMedia = kind === "training" || kind === "acknowledgment";

  if (done && !editing) {
    const submittedOn = formatSubmittedDate(submission?.submittedAt ?? progressRow?.completed_at ?? null);
    return (
      <>
        <StepContent content={content} showMedia={showMedia} />
        <Section>
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Completed{submittedOn ? ` on ${submittedOn}` : ""}
          </p>
          {submission?.fields.length ? (
            <dl className="mt-3 space-y-2 text-sm">
              {submission.fields
                .filter((field) => field.label !== "Statement")
                .map((field) => (
                  <div key={field.label} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{field.label}</dt>
                    <dd className="text-right font-medium text-slate-800 break-all">{field.value}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {!usesFirma ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-3 text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
            >
              Update my answers
            </button>
          ) : null}
        </Section>
        <ActionRow onBack={onBack} primaryLabel="Continue" onPrimary={onContinue} />
      </>
    );
  }

  return (
    <>
      <StepContent content={content} showMedia={showMedia} />
      {usesFirma ? (
        <FirmaSignedForm
          step={step}
          applicantId={applicantId}
          tenantSlug={tenantSlug}
          signerEmail={signer.email}
          signerEmailLoading={!signer.resolved}
          acknowledgmentText={content.acknowledgmentText}
          submit={submit}
          actions={actions}
        />
      ) : kind === "direct_deposit" ? (
        <DirectDepositForm
          stepKey={step.step_key}
          applicantId={applicantId}
          applicationId={onboarding?.applicationId ?? null}
          tenantSlug={tenantSlug}
          defaultHolderName={fullName}
          authorizationText={content.acknowledgmentText}
          isPreview={Boolean(onboarding?.isDraftPreview)}
          submit={submit}
          actions={actions}
        />
      ) : kind === "tax_withholding" ? (
        <TaxWithholdingForm certificationText={content.acknowledgmentText} submit={submit} actions={actions} />
      ) : kind === "i9_attestation" ? (
        <I9AttestationForm
          prefill={{ firstName: signer.firstName, lastName: signer.lastName, email: signer.email }}
          attestationText={content.acknowledgmentText}
          submit={submit}
          actions={actions}
        />
      ) : (
        <AcknowledgmentForm
          mode={kind === "training" ? "training" : "acknowledgment"}
          acknowledgmentText={content.acknowledgmentText}
          documentUrl={content.documentUrl}
          submit={submit}
          actions={actions}
        />
      )}
    </>
  );
}
