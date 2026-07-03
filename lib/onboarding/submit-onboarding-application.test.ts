import { describe, expect, it, vi, beforeEach } from "vitest";
import { submitOnboardingApplication } from "@/lib/onboarding/submit-onboarding-application";
import type { TenantOnboardingConfig, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

const WORKER_ID = "worker-1";
const TENANT_ID = "tenant-a";
const TEN = "tenant-a-slug";

const config: TenantOnboardingConfig = {
  configId: "cfg-1",
  tenantId: TENANT_ID,
  version: 1,
  steps: [
    {
      id: "s1",
      step_key: "resume_upload",
      title: "Resume",
      description: null,
      step_type: "resume_upload",
      sort_order: 1,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
    {
      id: "s2",
      step_key: "professional_license",
      title: "Professional License",
      description: null,
      step_type: "professional_license",
      sort_order: 2,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
    {
      id: "s3",
      step_key: "skill_assessment",
      title: "Skill Assessment",
      description: null,
      step_type: "skill_assessment",
      sort_order: 3,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
    {
      id: "s4",
      step_key: "authorizations",
      title: "Authorization agreement",
      description: null,
      step_type: "authorizations",
      sort_order: 4,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
    {
      id: "s5",
      step_key: "review_submit",
      title: "Review",
      description: null,
      step_type: "review_submit",
      sort_order: 5,
      is_required: true,
      is_enabled: true,
      metadata: {},
    },
  ],
  requiredDocuments: [],
  skillAssessments: [],
};

function progressPayload(overrides: Partial<WorkerOnboardingProgressPayload> = {}): WorkerOnboardingProgressPayload {
  return {
    progressId: "prog-1",
    status: "in_progress",
    steps: [
      { onboarding_step_id: "s1", status: "completed", completed_at: "2026-01-01T00:00:00.000Z", data: {} },
      { onboarding_step_id: "s2", status: "pending", completed_at: null, data: {} },
      { onboarding_step_id: "s3", status: "pending", completed_at: null, data: {} },
      { onboarding_step_id: "s4", status: "in_progress", completed_at: null, data: {} },
      { onboarding_step_id: "s5", status: "pending", completed_at: null, data: {} },
    ],
    ...overrides,
  };
}

vi.mock("@/lib/onboarding/resolve-onboarding-worker", () => ({
  resolveOnboardingWorker: vi.fn(),
}));

vi.mock("@/lib/onboarding/load-tenant-config", () => ({
  loadTenantOnboardingConfig: vi.fn(),
}));

vi.mock("@/lib/onboarding/ensure-worker-progress", () => ({
  ensureWorkerOnboardingProgress: vi.fn(),
}));

import { resolveOnboardingWorker } from "@/lib/onboarding/resolve-onboarding-worker";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";

describe("submitOnboardingApplication", () => {
  const updateCalls: { table: string; payload: Record<string, unknown> }[] = [];

  beforeEach(() => {
    updateCalls.length = 0;
    vi.clearAllMocks();

    vi.mocked(resolveOnboardingWorker).mockImplementation(async (_sb, applicantId, tenantSlug) => {
      if (!applicantId) return null;
      if (tenantSlug === TEN) {
        return { workerId: WORKER_ID, tenantId: TENANT_ID, userId: applicantId };
      }
      return null;
    });

    vi.mocked(loadTenantOnboardingConfig).mockResolvedValue(config);

    vi.mocked(ensureWorkerOnboardingProgress)
      .mockResolvedValueOnce(progressPayload())
      .mockResolvedValueOnce(
        progressPayload({
          submittedAt: "2026-07-01T12:00:00.000Z",
          submittedWithIncompleteSteps: true,
          incompleteStepKeys: ["professional_license", "skill_assessment", "authorizations"],
        })
      );
  });

  function createSupabaseMock() {
    return {
      from: vi.fn((table: string) => ({
        update: vi.fn((payload: Record<string, unknown>) => {
          updateCalls.push({ table, payload });
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }),
        eq: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      })),
    } as never;
  }

  it("rejects missing applicantId (auth required)", async () => {
    const result = await submitOnboardingApplication(createSupabaseMock(), {
      applicantId: "",
      tenantSlug: TEN,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects wrong tenant (tenant isolation)", async () => {
    const result = await submitOnboardingApplication(createSupabaseMock(), {
      applicantId: "user-1",
      tenantSlug: "tenant-b-slug",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });

  it("rejects submit when required steps are incomplete", async () => {
    const result = await submitOnboardingApplication(createSupabaseMock(), {
      applicantId: "user-1",
      tenantSlug: TEN,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/required steps/i);
    }
    expect(updateCalls).toHaveLength(0);
  });

  it("submits when all required steps are complete", async () => {
    vi.mocked(ensureWorkerOnboardingProgress).mockReset();
    vi.mocked(ensureWorkerOnboardingProgress)
      .mockResolvedValueOnce(
        progressPayload({
          steps: [
            { onboarding_step_id: "s1", status: "completed", completed_at: "2026-01-01T00:00:00.000Z", data: {} },
            { onboarding_step_id: "s2", status: "completed", completed_at: "2026-01-01T00:00:00.000Z", data: {} },
            { onboarding_step_id: "s3", status: "completed", completed_at: "2026-01-01T00:00:00.000Z", data: {} },
            { onboarding_step_id: "s4", status: "completed", completed_at: "2026-01-01T00:00:00.000Z", data: {} },
            { onboarding_step_id: "s5", status: "pending", completed_at: null, data: {} },
          ],
        })
      )
      .mockResolvedValueOnce(
        progressPayload({
          submittedAt: "2026-07-01T12:00:00.000Z",
          submittedWithIncompleteSteps: false,
          incompleteStepKeys: [],
        })
      );

    const supabase = createSupabaseMock();
    const result = await submitOnboardingApplication(supabase, {
      applicantId: "user-1",
      tenantSlug: TEN,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submittedWithIncompleteSteps).toBe(false);
      expect(result.incompleteStepKeys).toEqual([]);
      expect(result.applicationStatus).toBe("under_review");
    }
  });

  it("returns existing submission without overwriting (idempotent)", async () => {
    vi.mocked(ensureWorkerOnboardingProgress).mockReset();
    vi.mocked(ensureWorkerOnboardingProgress).mockResolvedValue(
      progressPayload({
        submittedAt: "2026-06-01T10:00:00.000Z",
        submittedWithIncompleteSteps: true,
        incompleteStepKeys: ["skill_assessment"],
        applicationStatus: "under_review",
      })
    );

    const supabase = createSupabaseMock();
    const result = await submitOnboardingApplication(supabase, {
      applicantId: "user-1",
      tenantSlug: TEN,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submittedAt).toBe("2026-06-01T10:00:00.000Z");
    }
    expect(updateCalls).toHaveLength(0);
  });
});
