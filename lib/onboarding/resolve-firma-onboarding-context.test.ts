import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveTenantIdBySlug = vi.fn();
const loadApplicantDraftOnboardingConfig = vi.fn();
const findOnboardingStepForFirmaSession = vi.fn();
const stepUsesFirmaSigning = vi.fn();
const resolveWorkerByApplicantId = vi.fn();
const resolveOrEnsureWorkerForApplicant = vi.fn();

vi.mock("@/lib/onboarding/resolve-worker-context", () => ({
  resolveTenantIdBySlug: (...args: unknown[]) => resolveTenantIdBySlug(...args),
  resolveWorkerByApplicantId: (...args: unknown[]) => resolveWorkerByApplicantId(...args),
  resolveOrEnsureWorkerForApplicant: (...args: unknown[]) =>
    resolveOrEnsureWorkerForApplicant(...args),
}));

vi.mock("@/lib/onboarding/load-applicant-draft-config", () => ({
  isPreviewOnboardingStepId: () => false,
  loadApplicantDraftOnboardingConfig: (...args: unknown[]) =>
    loadApplicantDraftOnboardingConfig(...args),
}));

vi.mock("@/lib/onboarding/load-tenant-config", () => ({
  loadTenantOnboardingConfig: vi.fn(),
}));

vi.mock("@/lib/onboarding/firma-step-settings", () => ({
  findOnboardingStepForFirmaSession: (...args: unknown[]) =>
    findOnboardingStepForFirmaSession(...args),
  stepUsesFirmaSigning: (...args: unknown[]) => stepUsesFirmaSigning(...args),
}));

describe("resolveFirmaOnboardingContext", () => {
  beforeEach(() => {
    vi.resetModules();
    resolveTenantIdBySlug.mockReset();
    loadApplicantDraftOnboardingConfig.mockReset();
    findOnboardingStepForFirmaSession.mockReset();
    stepUsesFirmaSigning.mockReset();
    resolveWorkerByApplicantId.mockReset();
    resolveOrEnsureWorkerForApplicant.mockReset();
  });

  it("uses draft preview path for ?preview=draft even with a leftover live applicant id (BUG-131)", async () => {
    resolveTenantIdBySlug.mockResolvedValue("tenant-1");
    loadApplicantDraftOnboardingConfig.mockResolvedValue({
      steps: [{ id: "step-1", step_key: "authorizations_documents" }],
    });
    findOnboardingStepForFirmaSession.mockResolvedValue({
      id: "step-1",
      step_key: "authorizations_documents",
    });
    stepUsesFirmaSigning.mockReturnValue(true);

    const { resolveFirmaOnboardingContext } = await import(
      "./resolve-firma-onboarding-context"
    );
    const result = await resolveFirmaOnboardingContext({
      supabase: {} as never,
      applicantId: "real-leftover-auth-user",
      stepKey: "authorizations_documents",
      tenantSlug: "zippycorp",
      preferDraftConfig: true,
    });

    expect(result).toMatchObject({
      ok: true,
      draftPreview: true,
      workerId: null,
      tenantId: "tenant-1",
    });
    expect(resolveWorkerByApplicantId).not.toHaveBeenCalled();
    expect(resolveOrEnsureWorkerForApplicant).not.toHaveBeenCalled();
  });
});
