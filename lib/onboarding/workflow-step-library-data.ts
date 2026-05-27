import type { OnboardingStepType } from "@/lib/onboarding/types";

export type WorkflowStepLibraryItem = {
  id: string;
  label: string;
  iconKey: string;
  description?: string;
  stepType: OnboardingStepType;
};

export type WorkflowStepLibraryCategory = {
  id: string;
  label: string;
  steps: WorkflowStepLibraryItem[];
};

export const WORKFLOW_STEP_LIBRARY_DATA: WorkflowStepLibraryCategory[] = [
  {
    id: "custom-steps",
    label: "Custom Steps",
    steps: [
      {
        id: "custom-step",
        label: "Custom Step",
        iconKey: "custom-step",
        description: "Add a tenant-specific instruction, question, or checkpoint.",
        stepType: "custom_question",
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
        iconKey: "resume-basic-profile",
        description: "Collect resume details and basic applicant profile information.",
        stepType: "resume_upload",
      },
      {
        id: "parameterized-job-application",
        label: "Parameterized Job Application",
        iconKey: "parameterized-job-application",
        description: "Collect role-specific application details.",
        stepType: "profile_information",
      },
      {
        id: "references-collection",
        label: "References Collection",
        iconKey: "references-collection",
        description: "Ask applicants to provide professional references.",
        stepType: "references",
      },
      {
        id: "skill-qualification-assessment",
        label: "Skill / Qualification Assessment",
        iconKey: "skill-qualification-assessment",
        description: "Assess applicant skills and qualifications.",
        stepType: "skill_assessment",
      },
      {
        id: "custom-application-form",
        label: "Custom Application Form",
        iconKey: "custom-application-form",
        description: "Add custom application questions for this tenant.",
        stepType: "custom_question",
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
        iconKey: "document-upload",
        description: "Request tenant-specific applicant documents.",
        stepType: "document_upload",
      },
      {
        id: "welcome-packet-esign",
        label: "Welcome Packet & eSign",
        iconKey: "welcome-packet-esign",
        description: "Collect signed onboarding packet acknowledgments.",
        stepType: "authorizations",
      },
      {
        id: "i9-right-to-work-verification",
        label: "I-9 / Right to Work Verification",
        iconKey: "i9-right-to-work-verification",
        description: "Request right-to-work verification documents.",
        stepType: "document_upload",
      },
      {
        id: "tax-forms",
        label: "Tax Forms (W-4 / State)",
        iconKey: "tax-forms",
        description: "Collect payroll tax forms.",
        stepType: "document_upload",
      },
      {
        id: "employee-agreement",
        label: "Employee Agreement / Contract eSign",
        iconKey: "employee-agreement",
        description: "Collect employee agreement signatures.",
        stepType: "authorizations",
      },
      {
        id: "policy-acknowledgment",
        label: "Policy Acknowledgment",
        iconKey: "policy-acknowledgment",
        description: "Collect policy acknowledgments.",
        stepType: "authorizations",
      },
      {
        id: "equipment-badge-acknowledgment",
        label: "Equipment / Badge Acknowledgment",
        iconKey: "equipment-badge-acknowledgment",
        description: "Track equipment or badge acknowledgment.",
        stepType: "document_upload",
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
        iconKey: "background-check",
        description: "Track background check completion.",
        stepType: "custom_question",
      },
      {
        id: "drug-test-screening",
        label: "Drug Test / Screening",
        iconKey: "drug-test-screening",
        description: "Track drug test or screening requirements.",
        stepType: "custom_question",
      },
      {
        id: "oig-exclusion-check",
        label: "OIG / Exclusion Check",
        iconKey: "oig-exclusion-check",
        description: "Track OIG or exclusion screening.",
        stepType: "custom_question",
      },
      {
        id: "reference-verification",
        label: "Reference Verification",
        iconKey: "reference-verification",
        description: "Track reference verification.",
        stepType: "references",
      },
      {
        id: "credential-license-verification",
        label: "Credential / License Verification",
        iconKey: "credential-license-verification",
        description: "Verify professional credentials and licenses.",
        stepType: "professional_license",
      },
      {
        id: "ssn-identity-verification",
        label: "SSN / Identity Verification",
        iconKey: "ssn-identity-verification",
        description: "Collect identity verification documentation.",
        stepType: "document_upload",
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
        iconKey: "direct-deposit-setup",
        description: "Collect direct deposit information.",
        stepType: "profile_information",
      },
      {
        id: "benefits-enrollment",
        label: "Benefits Enrollment / Selection",
        iconKey: "benefits-enrollment",
        description: "Collect benefits enrollment choices.",
        stepType: "profile_information",
      },
      {
        id: "401k-enrollment",
        label: "401K / Retirement Enrollment",
        iconKey: "401k-enrollment",
        description: "Collect retirement enrollment choices.",
        stepType: "profile_information",
      },
      {
        id: "pay-rate-hire-date",
        label: "Pay Rate & Hire Date Entry",
        iconKey: "pay-rate-hire-date",
        description: "Collect or confirm pay rate and hire date details.",
        stepType: "profile_information",
      },
      {
        id: "payroll-profile-creation",
        label: "Payroll Profile Creation",
        iconKey: "payroll-profile-creation",
        description: "Create the payroll profile checklist.",
        stepType: "profile_information",
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
        iconKey: "safety-training",
        description: "Assign safety training tasks.",
        stepType: "custom_question",
      },
      {
        id: "training-modules-quiz",
        label: "Training Modules + Quiz",
        iconKey: "training-modules-quiz",
        description: "Assign training modules and quiz questions.",
        stepType: "skill_assessment",
      },
      {
        id: "orientation-video",
        label: "Orientation / Onboarding Video",
        iconKey: "orientation-video",
        description: "Assign orientation content.",
        stepType: "custom_question",
      },
      {
        id: "compliance-training",
        label: "Compliance Training",
        iconKey: "compliance-training",
        description: "Assign compliance training content.",
        stepType: "custom_question",
      },
      {
        id: "certification-upload",
        label: "Certification Upload / Renewal",
        iconKey: "certification-upload",
        description: "Request certification upload or renewal details.",
        stepType: "professional_license",
      },
    ],
  },
];
