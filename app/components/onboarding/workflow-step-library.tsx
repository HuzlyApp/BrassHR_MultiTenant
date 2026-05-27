"use client";

import type { ReactNode } from "react";
import type { StepCategory } from "@/app/components/workflow-builder";
import type {
  WorkflowStepLibraryCategory,
  WorkflowStepLibraryItem,
} from "@/lib/onboarding/workflow-step-library-data";
import { WORKFLOW_STEP_LIBRARY_DATA } from "@/lib/onboarding/workflow-step-library-data";
import {
  BackgroundCheckIcon,
  BenefitsEnrollmentSelectionIcon,
  CertificationUploadRenewalIcon,
  ComplianceTrainingIcon,
  CredentialLicenseVerificationIcon,
  CustomApplicationFormIcon,
  CustomStepIcon,
  DirectDepositSetupIcon,
  DocumentUploadIcon,
  DrugTestScreeningIcon,
  EmployeeAgreementIcon,
  EquipmentBadgeAcknowledgmentIcon,
  I9RightToWorkVerificationIcon,
  OigExclusionCheckIcon,
  OrientationOnboardingVideoIcon,
  ParameterizedJobApplicationIcon,
  PayRateHireDateEntryIcon,
  PayrollProfileCreationIcon,
  PolicyAcknowledgmentIcon,
  ReferenceVerificationIcon,
  ReferencesCollectionIcon,
  ResumeBasicProfileIcon,
  RetirementEnrollmentIcon,
  SafetyTrainingIcon,
  SkillQualificationAssessmentIcon,
  SsnIdentityVerificationIcon,
  TaxFormsIcon,
  TrainingModulesQuizIcon,
  WelcomePacketESignIcon,
} from "@/app/components/workflow-builder/icons";

const ICONS: Record<string, ReactNode> = {
  "custom-step": <CustomStepIcon />,
  "resume-basic-profile": <ResumeBasicProfileIcon />,
  "parameterized-job-application": <ParameterizedJobApplicationIcon />,
  "references-collection": <ReferencesCollectionIcon />,
  "skill-qualification-assessment": <SkillQualificationAssessmentIcon />,
  "custom-application-form": <CustomApplicationFormIcon />,
  "document-upload": <DocumentUploadIcon />,
  "welcome-packet-esign": <WelcomePacketESignIcon />,
  "i9-right-to-work-verification": <I9RightToWorkVerificationIcon />,
  "tax-forms": <TaxFormsIcon />,
  "employee-agreement": <EmployeeAgreementIcon />,
  "policy-acknowledgment": <PolicyAcknowledgmentIcon />,
  "equipment-badge-acknowledgment": <EquipmentBadgeAcknowledgmentIcon />,
  "background-check": <BackgroundCheckIcon />,
  "drug-test-screening": <DrugTestScreeningIcon />,
  "oig-exclusion-check": <OigExclusionCheckIcon />,
  "reference-verification": <ReferenceVerificationIcon />,
  "credential-license-verification": <CredentialLicenseVerificationIcon />,
  "ssn-identity-verification": <SsnIdentityVerificationIcon />,
  "direct-deposit-setup": <DirectDepositSetupIcon />,
  "benefits-enrollment": <BenefitsEnrollmentSelectionIcon />,
  "401k-enrollment": <RetirementEnrollmentIcon />,
  "pay-rate-hire-date": <PayRateHireDateEntryIcon />,
  "payroll-profile-creation": <PayrollProfileCreationIcon />,
  "safety-training": <SafetyTrainingIcon />,
  "training-modules-quiz": <TrainingModulesQuizIcon />,
  "orientation-video": <OrientationOnboardingVideoIcon />,
  "compliance-training": <ComplianceTrainingIcon />,
  "certification-upload": <CertificationUploadRenewalIcon />,
};

function hydrateStep(step: WorkflowStepLibraryItem) {
  return {
    id: step.id,
    label: step.label,
    description: step.description,
    icon: ICONS[step.iconKey] ?? <CustomStepIcon />,
  };
}

export function hydrateWorkflowStepLibrary(
  data: WorkflowStepLibraryCategory[] = WORKFLOW_STEP_LIBRARY_DATA
): StepCategory[] {
  return data.map((category) => ({
    id: category.id,
    label: category.label,
    steps: category.steps.map(hydrateStep),
  }));
}

export const ONBOARDING_WORKFLOW_STEP_LIBRARY: StepCategory[] = hydrateWorkflowStepLibrary();

export function buildWorkflowStepLookup(
  library: StepCategory[] = ONBOARDING_WORKFLOW_STEP_LIBRARY
): Map<string, { id: string; label: string; icon: ReactNode }> {
  const map = new Map<string, { id: string; label: string; icon: ReactNode }>();
  for (const category of library) {
    for (const step of category.steps) {
      map.set(step.id, step);
    }
  }
  return map;
}
