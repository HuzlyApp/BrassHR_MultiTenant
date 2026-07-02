import { describe, expect, it, vi } from "vitest";
import { resolveApplicantContinuationTarget } from "@/lib/onboarding/applicant-continuation-link";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";

vi.mock("@/lib/onboarding/load-tenant-config", () => ({
  loadTenantOnboardingConfig: vi.fn(async () => mockConfig),
}));

vi.mock("@/lib/onboarding/ensure-worker-progress", () => ({
  ensureWorkerOnboardingProgress: vi.fn(async () => mockProgress),
}));

const steps: TenantOnboardingStep[] = [
  {
    id: "step-resume",
    step_key: "resume_upload",
    title: "Resume",
    description: null,
    step_type: "resume_upload",
    sort_order: 10,
    is_required: true,
    is_enabled: true,
    metadata: {},
  },
  {
    id: "step-license",
    step_key: "professional_license",
    title: "License",
    description: null,
    step_type: "professional_license",
    sort_order: 20,
    is_required: true,
    is_enabled: true,
    metadata: {},
  },
  {
    id: "step-summary",
    step_key: "review_submit",
    title: "Summary",
    description: null,
    step_type: "review_submit",
    sort_order: 90,
    is_required: true,
    is_enabled: true,
    metadata: {},
  },
];

const mockConfig: TenantOnboardingConfig = {
  configId: "cfg-1",
  tenantId: "tenant-1",
  version: 1,
  steps,
  requiredDocuments: [],
  skillAssessments: [],
};

const mockProgress = {
  progressId: "prog-1",
  status: "in_progress" as const,
  steps: [
    {
      onboarding_step_id: "step-resume",
      status: "completed" as const,
      completed_at: "2026-01-01",
      data: {},
    },
    {
      onboarding_step_id: "step-license",
      status: "pending" as const,
      completed_at: null,
      data: {},
    },
  ],
};

describe("resolveApplicantContinuationTarget", () => {
  it("routes status links to the next incomplete onboarding step", async () => {
    const supabase = {} as never;
    const target = await resolveApplicantContinuationTarget(supabase, {
      workerId: "worker-1",
      tenantId: "tenant-1",
      tenantSlug: "zipstaff",
    });

    expect(target.stepKey).toBe("professional_license");
    expect(target.path).toContain("professional-license");
    expect(target.path).toContain("tenant=zipstaff");
  });
});
