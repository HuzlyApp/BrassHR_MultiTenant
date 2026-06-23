"use client";

import type { ComponentType } from "react";
import type {
  ApplicantStepStatus,
  PublishedWorkflowStep,
} from "@/lib/onboarding/applicant-workflow-types";
import {
  BackgroundCheckStep,
  DocumentUploadStep,
  ReferenceVerificationStep,
  SkillAssessmentStep,
  UnsupportedStepFallback,
} from "@/app/components/onboarding/applicant-steps/ApplicantStepViews";

type StepRendererProps = {
  step: PublishedWorkflowStep;
  status?: ApplicantStepStatus | null;
};

export const stepRenderers: Record<
  string,
  ComponentType<StepRendererProps>
> = {
  skill_qualification_assessment: SkillAssessmentStep,
  document_upload: DocumentUploadStep,
  background_check: BackgroundCheckStep,
  reference_verification: ReferenceVerificationStep,
};

export function DynamicStepRenderer({ step, status }: StepRendererProps) {
  const Renderer = stepRenderers[step.type] ?? UnsupportedStepFallback;
  return <Renderer step={step} status={status} />;
}

export {
  SkillAssessmentStep,
  DocumentUploadStep,
  BackgroundCheckStep,
  ReferenceVerificationStep,
};
