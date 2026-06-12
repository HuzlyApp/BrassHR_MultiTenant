"use client";

import type { ReactNode } from "react";
import type { StepCategory } from "@/app/components/workflow-builder";
import type {
  WorkflowStepLibraryCategory,
  WorkflowStepLibraryItem,
} from "@/lib/onboarding/workflow-step-library-data";
import { WORKFLOW_STEP_LIBRARY_DATA } from "@/lib/onboarding/workflow-step-library-data";
import {
  AdverseActionProcessIcon,
  BackgroundCheckIcon,
  BadgeEquipmentIssuanceIcon,
  BenefitsConfirmationIcon,
  BenefitsEnrollmentSelectionIcon,
  BuddyMentorAssignmentIcon,
  CertificationUploadRenewalIcon,
  CompletionMilestoneIcon,
  ComplianceTrainingIcon,
  ConditionalBranchIcon,
  ConditionalLogicIcon,
  CredentialLicenseVerificationIcon,
  CustomApplicationFormIcon,
  CustomFormIcon,
  CustomStepIcon,
  DirectDepositSetupIcon,
  DocumentUploadIcon,
  DrugTestScreeningIcon,
  EmployeeAgreementIcon,
  EquipmentBadgeAcknowledgmentIcon,
  ExternalIntegrationIcon,
  FacilityAccessSetupIcon,
  FinalOnboardingCallIcon,
  HrFinalApprovalIcon,
  I9RightToWorkVerificationIcon,
  ManagerFacilityApprovalIcon,
  ManagerWelcomeCallIcon,
  ManualTaskHrActionIcon,
  OigExclusionCheckIcon,
  OfferAcceptanceIcon,
  OrientationOnboardingVideoIcon,
  ParallelStepGroupIcon,
  ParameterizedJobApplicationIcon,
  PayRateHireDateEntryIcon,
  PayrollProfileCreationIcon,
  PolicyAcknowledgmentIcon,
  ReferenceVerificationIcon,
  ReferencesCollectionIcon,
  ReminderFollowUpNotificationIcon,
  ResumeBasicProfileIcon,
  RetirementEnrollmentIcon,
  SafetyTrainingIcon,
  ScheduleAssignmentIcon,
  SkillQualificationAssessmentIcon,
  SsnIdentityVerificationIcon,
  StatusUpdateEmailNotificationIcon,
  TaxFormsIcon,
  TrainingModulesQuizIcon,
  WelcomeEmailIcon,
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
  "offer-acceptance": <OfferAcceptanceIcon />,
  "manager-facility-approval": <ManagerFacilityApprovalIcon />,
  "hr-final-approval": <HrFinalApprovalIcon />,
  "conditional-branch-decision": <ConditionalBranchIcon />,
  "adverse-action-process": <AdverseActionProcessIcon />,
  "welcome-email": <WelcomeEmailIcon />,
  "status-update-notification": <StatusUpdateEmailNotificationIcon />,
  "manager-welcome-call": <ManagerWelcomeCallIcon />,
  "final-onboarding-call": <FinalOnboardingCallIcon />,
  "reminder-follow-up-notification": <ReminderFollowUpNotificationIcon />,
  "badge-equipment-issuance": <BadgeEquipmentIssuanceIcon />,
  "buddy-mentor-assignment": <BuddyMentorAssignmentIcon />,
  "schedule-assignment": <ScheduleAssignmentIcon />,
  "facility-access-setup": <FacilityAccessSetupIcon />,
  "benefits-confirmation": <BenefitsConfirmationIcon />,
  "custom-form": <CustomFormIcon />,
  "manual-task-hr-action": <ManualTaskHrActionIcon />,
  "external-integration": <ExternalIntegrationIcon />,
  "conditional-logic": <ConditionalLogicIcon />,
  "parallel-step-group": <ParallelStepGroupIcon />,
  "completion-milestone": <CompletionMilestoneIcon />,
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
