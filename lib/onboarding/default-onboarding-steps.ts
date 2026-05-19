import type { OnboardingStepType } from "@/lib/onboarding/types";

export type OnboardingStepDraft = {
  step_key: string;
  title: string;
  description: string;
  step_type: OnboardingStepType;
  sort_order: number;
  is_required: boolean;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
  required_documents: Array<{
    title: string;
    description: string;
    is_required: boolean;
    sort_order: number;
  }>;
};

export function createDefaultOnboardingStepDrafts(): OnboardingStepDraft[] {
  return [
    {
      step_key: "resume_upload",
      title: "Add Resume",
      description: "Upload and review your resume",
      step_type: "resume_upload",
      sort_order: 10,
      is_required: true,
      is_enabled: true,
      metadata: { parsing_enabled: true, required: true },
      required_documents: [],
    },
    {
      step_key: "professional_license",
      title: "Professional License",
      description: "Upload professional license documents",
      step_type: "professional_license",
      sort_order: 20,
      is_required: true,
      is_enabled: true,
      metadata: {},
      required_documents: [
        {
          title: "Nursing License",
          description: "Front and back if applicable",
          is_required: true,
          sort_order: 10,
        },
        {
          title: "TB Test",
          description: "Within the last 12 months",
          is_required: true,
          sort_order: 20,
        },
        {
          title: "CPR Certifications",
          description: "",
          is_required: true,
          sort_order: 30,
        },
      ],
    },
    {
      step_key: "skill_assessment",
      title: "Skill Assessment",
      description: "Complete the skills assessment",
      step_type: "skill_assessment",
      sort_order: 30,
      is_required: true,
      is_enabled: true,
      metadata: {},
      required_documents: [],
    },
    {
      step_key: "authorizations",
      title: "Authorizations & Documents",
      description: "Upload required authorization documents",
      step_type: "authorizations",
      sort_order: 40,
      is_required: true,
      is_enabled: true,
      metadata: {},
      required_documents: [
        {
          title: "SSN Card",
          description: "Upload SSN card (front/back if applicable)",
          is_required: true,
          sort_order: 10,
        },
        {
          title: "Driver's License",
          description: "Upload driver's license",
          is_required: true,
          sort_order: 20,
        },
        {
          title: "Employee Agreement",
          description: "Signed employee agreement",
          is_required: true,
          sort_order: 30,
        },
      ],
    },
    {
      step_key: "references",
      title: "Add References",
      description: "Provide professional references",
      step_type: "references",
      sort_order: 50,
      is_required: true,
      is_enabled: true,
      metadata: { min_count: 2 },
      required_documents: [],
    },
    {
      step_key: "review_submit",
      title: "Summary",
      description: "Review and submit your application",
      step_type: "review_submit",
      sort_order: 60,
      is_required: true,
      is_enabled: true,
      metadata: {},
      required_documents: [],
    },
  ];
}

export function reindexStepSortOrders(steps: OnboardingStepDraft[]): OnboardingStepDraft[] {
  return steps.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 }));
}
