import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveOrEnsureWorkerForApplicantMock = vi.hoisted(() => vi.fn());
const resolveOnboardingTenantIdMock = vi.hoisted(() => vi.fn());
const markTenantStepCompletedByTypeMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "worker_references") {
        const eqChain: {
          eq: ReturnType<typeof vi.fn>;
          then?: (resolve: (value: { error: null }) => unknown) => unknown;
        } = {
          eq: vi.fn(() => eqChain),
        };
        eqChain.then = (resolve) => resolve({ error: null });
        return {
          delete: vi.fn(() => eqChain),
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: vi.fn(() => "https://example.supabase.co"),
}));

vi.mock("@/lib/onboarding/resolve-worker-context", () => ({
  resolveOrEnsureWorkerForApplicant: (...args: unknown[]) =>
    resolveOrEnsureWorkerForApplicantMock(...args),
}));

vi.mock("@/lib/tenant/resolve-onboarding-tenant-id", () => ({
  resolveOnboardingTenantId: (...args: unknown[]) => resolveOnboardingTenantIdMock(...args),
}));

vi.mock("@/lib/onboarding/mark-tenant-step-completed", () => ({
  markTenantStepCompletedByType: (...args: unknown[]) =>
    markTenantStepCompletedByTypeMock(...args),
}));

async function postReferences(body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/onboarding/worker-references/route");
  return POST(
    new Request("http://localhost/api/onboarding/worker-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

const twoRefs = [
  {
    first: "Carl",
    last: "Elipan",
    phone: "09624360070",
    email: "clelipan@up.edu.ph",
    relationship: "Manager",
    company: "UP",
    jobTitle: "Supervisor",
  },
  {
    first: "Jane",
    last: "Doe",
    phone: "5551234567",
    email: "jane@example.com",
    relationship: "Colleague",
    company: "Acme",
    jobTitle: "Nurse",
  },
];

describe("onboarding worker-references route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    resolveOnboardingTenantIdMock.mockResolvedValue({ ok: true, tenantId: "tenant-zipstaff" });
    resolveOrEnsureWorkerForApplicantMock.mockResolvedValue({
      workerId: "worker-zipstaff",
      tenantId: "tenant-zipstaff",
      userId: "auth-user-1",
    });
    markTenantStepCompletedByTypeMock.mockResolvedValue(undefined);
  });

  it("resolves worker using tenantSlug for multi-tenant applicants", async () => {
    const res = await postReferences({
      applicantId: "1e14012f-9291-48f3-bd83-a9fa575d015a",
      tenantSlug: "zipstaff",
      references: twoRefs,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, count: 2 });
    expect(resolveOrEnsureWorkerForApplicantMock).toHaveBeenCalledWith(
      expect.anything(),
      "1e14012f-9291-48f3-bd83-a9fa575d015a",
      "zipstaff"
    );
    expect(markTenantStepCompletedByTypeMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workerId: "worker-zipstaff",
        tenantId: "tenant-zipstaff",
        stepType: "references",
      })
    );
  });

  it("requires tenantSlug", async () => {
    const res = await postReferences({
      applicantId: "auth-user-1",
      references: twoRefs,
    });

    expect(res.status).toBe(400);
    expect(resolveOrEnsureWorkerForApplicantMock).not.toHaveBeenCalled();
  });
});
