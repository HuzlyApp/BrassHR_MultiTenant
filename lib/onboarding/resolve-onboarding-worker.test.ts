import { describe, expect, it, vi } from "vitest";
import {
  readOnboardingTenantSlugFromRequest,
  resolveOnboardingWorker,
} from "@/lib/onboarding/resolve-onboarding-worker";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

const ZIPSTAFF_TENANT = "9b1b72ab-2d9f-4a2c-9839-bbae260ec15a";

vi.mock("@/lib/onboarding/resolve-worker-context", () => ({
  resolveTenantIdBySlug: vi.fn(async (_sb: unknown, slug: string) =>
    slug === "zipstaff" ? ZIPSTAFF_TENANT : null
  ),
  resolveWorkerByApplicantId: vi.fn(async (_sb, applicantId: string, tenantId?: string | null) => {
    if (tenantId === ZIPSTAFF_TENANT) {
      return { workerId: "worker-zip", tenantId: ZIPSTAFF_TENANT, userId: applicantId };
    }
    return null;
  }),
  resolveOrEnsureWorkerForApplicant: vi.fn(async (_sb, applicantId: string) => ({
    workerId: "worker-created",
    tenantId: ZIPSTAFF_TENANT,
    userId: applicantId,
  })),
}));

describe("readOnboardingTenantSlugFromRequest", () => {
  it("prefers tenantSlug from form data", () => {
    const fd = new FormData();
    fd.append("tenantSlug", "zipstaff");
    const slug = readOnboardingTenantSlugFromRequest(
      new Request("https://zipstaff.brasshr.com/api/onboarding/documents/upload"),
      fd
    );
    expect(slug).toBe("zipstaff");
  });

  it("falls back to onboarding tenant cookie", () => {
    const slug = readOnboardingTenantSlugFromRequest(
      new Request("https://zipstaff.brasshr.com/api/onboarding/documents/upload", {
        headers: { cookie: `${ONBOARDING_TENANT_SLUG_COOKIE}=remotecompany` },
      })
    );
    expect(slug).toBe("remotecompany");
  });
});

describe("resolveOnboardingWorker", () => {
  it("scopes worker lookup to the active tenant slug", async () => {
    const worker = await resolveOnboardingWorker({} as never, "user-1", "zipstaff");
    expect(worker).toEqual({
      workerId: "worker-zip",
      tenantId: ZIPSTAFF_TENANT,
      userId: "user-1",
    });
  });
});
