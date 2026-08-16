import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveOrEnsureWorkerForApplicant,
  resolveWorkerByApplicantId,
} from "@/lib/onboarding/resolve-worker-context";

const ZIPSTAFF_TENANT = "9b1b72ab-2d9f-4a2c-9839-bbae260ec15a";
const NEXUS_TENANT = "8e13d397-263b-424a-8348-490c900550c0";
const APPLICANT_ID = "a28c284c-ed9f-476c-94dc-954fdd934603";

vi.mock("@/lib/onboarding/resolve-tenant-id-by-slug", () => ({
  resolveTenantIdBySlug: vi.fn(async (_sb: unknown, slug: string) => {
    if (slug === "zipstaff") return ZIPSTAFF_TENANT;
    if (slug === "nexus") return NEXUS_TENANT;
    return null;
  }),
}));

vi.mock("@/lib/onboarding/persist-worker-row", () => ({
  persistWorkerRow: vi.fn(async () => ({ ok: true as const })),
}));

function createSupabase(workers: Array<{ id: string; user_id: string; tenant_id: string }>) {
  return {
    from: (table: string) => {
      if (table !== "worker") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (column: string, value: string) => ({
            eq: (column2: string, value2: string) => ({
              maybeSingle: async () => {
                const row = workers.find(
                  (w) =>
                    (column === "user_id" ? w.user_id === value : w.id === value) &&
                    (column2 === "tenant_id" ? w.tenant_id === value2 : true)
                );
                return { data: row ?? null, error: null };
              },
            }),
            order: () => ({
              limit: async () => {
                const rows = workers.filter((w) =>
                  column === "user_id" ? w.user_id === value : w.id === value
                );
                return { data: rows.slice(0, 1), error: null };
              },
            }),
            maybeSingle: async () => {
              const row = workers.find((w) =>
                column === "user_id" ? w.user_id === value : w.id === value
              );
              return { data: row ?? null, error: null };
            },
          }),
        }),
      };
    },
  };
}

describe("resolveWorkerByApplicantId tenant scoping", () => {
  it("does not fall back to another tenant when tenantId is provided", async () => {
    const supabase = createSupabase([
      {
        id: "worker-nexus",
        user_id: APPLICANT_ID,
        tenant_id: NEXUS_TENANT,
      },
    ]);

    const scoped = await resolveWorkerByApplicantId(
      supabase as never,
      APPLICANT_ID,
      ZIPSTAFF_TENANT
    );

    expect(scoped).toBeNull();
  });
});

describe("resolveOrEnsureWorkerForApplicant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a zipstaff worker instead of reusing a nexus worker", async () => {
    const supabase = createSupabase([
      {
        id: "worker-nexus",
        user_id: APPLICANT_ID,
        tenant_id: NEXUS_TENANT,
      },
    ]);

    const { persistWorkerRow } = await import("@/lib/onboarding/persist-worker-row");

    await resolveOrEnsureWorkerForApplicant(supabase as never, APPLICANT_ID, "zipstaff");

    expect(persistWorkerRow).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        applicantId: APPLICANT_ID,
        tenantId: ZIPSTAFF_TENANT,
      })
    );

    const unscoped = await resolveWorkerByApplicantId(supabase as never, APPLICANT_ID);
    expect(unscoped?.tenantId).toBe(NEXUS_TENANT);
  });
});
