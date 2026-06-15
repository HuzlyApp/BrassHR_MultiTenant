'use client';

import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useEffect } from "react";

import { WorkflowBuilder } from "@/app/components/workflow-builder";
import type { StepCategory, WorkflowState } from "@/app/components/workflow-builder";
import {
  AdverseActionProcessIcon,
  BadgeEquipmentIssuanceIcon,
  BackgroundCheckIcon,
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
  FacilityAccessSetupIcon,
  FinalOnboardingCallIcon,
  DocumentUploadIcon,
  DrugTestScreeningIcon,
  EmployeeAgreementIcon,
  EquipmentBadgeAcknowledgmentIcon,
  ExternalIntegrationIcon,
  I9RightToWorkVerificationIcon,
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
  HrFinalApprovalIcon,
  SafetyTrainingIcon,
  ScheduleAssignmentIcon,
  SkillQualificationAssessmentIcon,
  StatusUpdateEmailNotificationIcon,
  SsnIdentityVerificationIcon,
  TaxFormsIcon,
  TrainingModulesQuizIcon,
  ManagerFacilityApprovalIcon,
  WelcomeEmailIcon,
  WelcomePacketESignIcon,
} from "@/app/components/workflow-builder/icons";

const STEP_LIBRARY: StepCategory[] = [
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
  {
    id: "approval-decision",
    label: "Approval & Decision Steps",
    steps: [
      {
        id: "offer-acceptance",
        label: "Offer Acceptance",
        icon: <OfferAcceptanceIcon />,
      },
      {
        id: "manager-facility-approval",
        label: "Manager / Facility Approval",
        icon: <ManagerFacilityApprovalIcon />,
      },
      {
        id: "hr-final-approval",
        label: "HR Final Approval",
        icon: <HrFinalApprovalIcon />,
      },
      {
        id: "conditional-branch-decision",
        label: "Conditional Branch",
        icon: <ConditionalBranchIcon />,
      },
      {
        id: "adverse-action-process",
        label: "Adverse Action Process",
        icon: <AdverseActionProcessIcon />,
      },
    ],
  },
  {
    id: "communication-notification",
    label: "Communication & Notification Steps",
    steps: [
      {
        id: "welcome-email",
        label: "Welcome Email",
        icon: <WelcomeEmailIcon />,
      },
      {
        id: "status-update-notification",
        label: "Status Update Email / Notification",
        icon: <StatusUpdateEmailNotificationIcon />,
      },
      {
        id: "manager-welcome-call",
        label: "Manager Welcome Call",
        icon: <ManagerWelcomeCallIcon />,
      },
      {
        id: "final-onboarding-call",
        label: "Final Onboarding Call",
        icon: <FinalOnboardingCallIcon />,
      },
      {
        id: "reminder-follow-up-notification",
        label: "Reminder / Follow-up Notification",
        icon: <ReminderFollowUpNotificationIcon />,
      },
    ],
  },
  {
    id: "team-operational",
    label: "Team & Operational Steps",
    steps: [
      {
        id: "badge-equipment-issuance",
        label: "Badge / Equipment Issuance",
        icon: <BadgeEquipmentIssuanceIcon />,
      },
      {
        id: "buddy-mentor-assignment",
        label: "Buddy / Mentor Assignment",
        icon: <BuddyMentorAssignmentIcon />,
      },
      {
        id: "schedule-assignment",
        label: "Schedule Assignment",
        icon: <ScheduleAssignmentIcon />,
      },
      {
        id: "facility-access-setup",
        label: "Facility Access Setup",
        icon: <FacilityAccessSetupIcon />,
      },
      {
        id: "benefits-confirmation",
        label: "Benefits Confirmation",
        icon: <BenefitsConfirmationIcon />,
      },
    ],
  },
  {
    id: "custom-flexible",
    label: "Custom & Flexible Steps",
    steps: [
      {
        id: "custom-form",
        label: "Custom Form",
        icon: <CustomFormIcon />,
      },
      {
        id: "manual-task-hr-action",
        label: "Manual Task / HR Action",
        icon: <ManualTaskHrActionIcon />,
      },
      {
        id: "external-integration",
        label: "External Integration",
        icon: <ExternalIntegrationIcon />,
      },
      {
        id: "conditional-logic",
        label: "Conditional Logic",
        icon: <ConditionalLogicIcon />,
      },
      {
        id: "parallel-step-group",
        label: "Parallel Step Group",
        icon: <ParallelStepGroupIcon />,
      },
      {
        id: "completion-milestone",
        label: "Completion / Milestone",
        icon: <CompletionMilestoneIcon />,
      },
    ],
  },
];

type OnboardingBuilderPageProps = {
  dashboardBasePath?: string;
  redirectLegacyPath?: boolean;
  hideTopChrome?: boolean;
};

export function OnboardingBuilderPage({
  dashboardBasePath = "/braas-hr/dashboard",
  redirectLegacyPath = true,
  hideTopChrome = false,
}: OnboardingBuilderPageProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (redirectLegacyPath && pathname === "/braas-hr/dashboard/onboarding-builder") {
      router.replace("/admin_recruiter/dashboard/onboarding-builder");
    }
  }, [pathname, redirectLegacyPath, router]);

  if (redirectLegacyPath && pathname === "/braas-hr/dashboard/onboarding-builder") {
    return null;
  }

  const handleSave = (_state: WorkflowState) => {
    toast.success("Saved as template");
  };

  const handlePreview = (_state: WorkflowState) => {
    toast("Preview coming soon");
  };

  const handlePublish = (_state: WorkflowState) => {
    toast.success("Published to all new hires");
  };

  return (
    <WorkflowBuilder
      title="Standard Hiring"
      subtitle="New Hire: Pre-Offer (ATS)"
      productName="Onboarding Builder"
      brandName="Brass HR"
      stepLibrary={STEP_LIBRARY}
      lastUpdated={{ author: "Sam Smith", minutesAgo: 4 }}
      onBack={() => router.push(`${dashboardBasePath}/onboarding-flows`)}
      onSaveAsTemplate={handleSave}
      onPreview={handlePreview}
      onPublish={handlePublish}
      hideTopChrome={hideTopChrome}
    />
  );
}

export default function BraasOnboardingBuilderPage() {
  return <OnboardingBuilderPage dashboardBasePath="/braas-hr/dashboard" redirectLegacyPath />;
}
