"use client";

import type { ReactNode } from "react";
import type { StepCategory } from "@/app/components/workflow-builder";
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

export const ONBOARDING_WORKFLOW_STEP_LIBRARY: StepCategory[] = [
  {
    id: "custom-steps",
    label: "Custom Steps",
    steps: [
      {
        id: "custom-step",
        label: "Custom Step",
        icon: <CustomStepIcon />,
      },
    ],
  },
  {
    id: "application-profile",
    label: "Application & Profile",
    steps: [
      {
        id: "resume-basic-profile",
        label: "Resume & Basic Profile",
        icon: <ResumeBasicProfileIcon  />,
      },
      {
        id: "parameterized-job-application",
        label: "Parameterized Job Application",
        icon: <ParameterizedJobApplicationIcon />,
      },
      {
        id: "references-collection",
        label: "References Collection",
        icon: <ReferencesCollectionIcon />,
      },  
      {
        id: "skill-qualification-assessment",
        label: "Skill / Qualification Assessment",
        icon: <SkillQualificationAssessmentIcon />,
      },
      {
        id: "custom-application-form",
        label: "Custom Application Form",
        icon: <CustomApplicationFormIcon />,
      },
    ],
  },
  {
    id: "document-esign",
    label: "Document & eSign",
    steps: [
      {
        id: "document-upload",
        label: "Document Upload",
        icon: <DocumentUploadIcon />,
      },
      {
        id: "welcome-packet-esign",
        label: "Welcome Packet & eSign",
        icon: <WelcomePacketESignIcon />,
      },
      {
        id: "i9-right-to-work-verification",
        label: "I-9 / Right to Work Verification",
        icon: <I9RightToWorkVerificationIcon />,
      },
      {
        id: "tax-forms",
        label: "Tax Forms (W-4 / State)",
        icon: <TaxFormsIcon />,
      },
      {
        id: "employee-agreement",
        label: "Employee Agreement / Contract eSign",
        icon: <EmployeeAgreementIcon />,
      },
      {
        id: "policy-acknowledgment",
        label: "Policy Acknowledgment",
        icon: <PolicyAcknowledgmentIcon />,
      },
      {
        id: "equipment-badge-acknowledgment",
        label: "Equipment / Badge Acknowledgment",
        icon: <EquipmentBadgeAcknowledgmentIcon />,
      },
    ],
  },
  {
    id: "screening-compliance",
    label: "Screening & Compliance Steps",
    steps: [
      {
        id: "background-check",
        label: "Background Check",
        icon: <BackgroundCheckIcon />,
      },
      {
        id: "drug-test-screening",
        label: "Drug Test / Screening",
        icon: <DrugTestScreeningIcon />,
      },
      {
        id: "oig-exclusion-check",
        label: "OIG / Exclusion Check",
        icon: <OigExclusionCheckIcon />,
      },
      {
        id: "reference-verification",
        label: "Reference Verification",
        icon: <ReferenceVerificationIcon />,
      },
      {
        id: "credential-license-verification",
        label: "Credential / License Verification",
        icon: <CredentialLicenseVerificationIcon />,
      },
      {
        id: "ssn-identity-verification",
        label: "SSN / Identity Verification",
        icon: <SsnIdentityVerificationIcon />,
      },
    ],
  },
  {
    id: "payroll-financial",
    label: "Payroll & Financial Steps",
    steps: [
      {
        id: "direct-deposit-setup",
        label: "Direct Deposit Setup",
        icon: <DirectDepositSetupIcon />,
      },
      {
        id: "benefits-enrollment",
        label: "Benefits Enrollment / Selection",
        icon: <BenefitsEnrollmentSelectionIcon />,
      },
      {
        id: "401k-enrollment",
        label: "401K / Retirement Enrollment",
        icon: <RetirementEnrollmentIcon />,
      },
      {
        id: "pay-rate-hire-date",
        label: "Pay Rate & Hire Date Entry",
        icon: <PayRateHireDateEntryIcon />,
      },
      {
        id: "payroll-profile-creation",
        label: "Payroll Profile Creation",
        icon: <PayrollProfileCreationIcon />,
      },
    ],
  },
  {
    id: "training-development",
    label: "Training & Development Steps",
    steps: [
      {
        id: "safety-training",
        label: "Safety Training",
        icon: <SafetyTrainingIcon />,
      },
      {
        id: "training-modules-quiz",
        label: "Training Modules + Quiz",
        icon: <TrainingModulesQuizIcon />,
      },
      {
        id: "orientation-video",
        label: "Orientation / Onboarding Video",
        icon: <OrientationOnboardingVideoIcon />,
      },
      {
        id: "compliance-training",
        label: "Compliance Training",
        icon: <ComplianceTrainingIcon />,
      },
      {
        id: "certification-upload",
        label: "Certification Upload / Renewal",
        icon: <CertificationUploadRenewalIcon />,
      },
    ],
  },
];

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
