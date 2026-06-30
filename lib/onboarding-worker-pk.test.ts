// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkerSessionContext } from "@/lib/onboarding-worker-pk";

const ZIPSTAFF_TENANT = "9b1b72ab-2d9f-4a2c-9839-bbae260ec15a";
const NEXUS_TENANT = "8e13d397-263b-424a-8348-490c900550c0";
const APPLICANT_ID = "a28c284c-ed9f-476c-94dc-954fdd934603";

vi.mock("@/lib/tenant/client-onboarding-slug", () => ({
  resolveClientOnboardingTenantSlug: vi.fn(() => "zipstaff"),
}));

vi.mock("@/lib/onboarding/resolve-tenant-id-by-slug", () => ({
  resolveTenantIdBySlug: vi.fn(async (_sb: unknown, slug: string) => {
    if (slug === "zipstaff") return ZIPSTAFF_TENANT;
    if (slug === "nexus") return NEXUS_TENANT;
    return null;
  }),
}));

function createSupabase(workers: Array<{ id: string; user_id: string; tenant_id: string | null }>) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: APPLICANT_ID } }, error: null })),
    },
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
            limit: async (n: number) => {
              const matches = workers.filter((w) =>
                column === "user_id" ? w.user_id === value : w.id === value
              );
              return { data: matches.slice(0, n), error: null };
            },
            maybeSingle: async () => {
              const matches = workers.filter((w) =>
                column === "user_id" ? w.user_id === value : w.id === value
              );
              if (matches.length > 1) {
                return {
                  data: null,
                  error: {
                    code: "PGRST116",
                    message: "JSON object requested, multiple (or no) rows returned",
                  },
                };
              }
              return { data: matches[0] ?? null, error: null };
            },
          }),
        }),
      };
    },
  };
}

describe("getWorkerSessionContext tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the worker row for the active tenant subdomain", async () => {
    const supabase = createSupabase([
      { id: "worker-zip", user_id: APPLICANT_ID, tenant_id: ZIPSTAFF_TENANT },
      { id: "worker-nexus", user_id: APPLICANT_ID, tenant_id: NEXUS_TENANT },
    ]);

    const ctx = await getWorkerSessionContext(supabase as never);

    expect(ctx).toEqual({ id: "worker-zip", tenantId: ZIPSTAFF_TENANT });
  });

  it("does not fail when multiple worker rows exist across tenants", async () => {
    const supabase = createSupabase([
      { id: "worker-zip", user_id: APPLICANT_ID, tenant_id: ZIPSTAFF_TENANT },
      { id: "worker-nexus", user_id: APPLICANT_ID, tenant_id: NEXUS_TENANT },
    ]);

    await expect(getWorkerSessionContext(supabase as never)).resolves.not.toThrow();
  });
});
