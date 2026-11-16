import { describe, expect, it, vi } from "vitest";
import { loadTenantFeatures, parseEdition, requireTenantFeature } from "./edition-features";

function client(category: unknown, rows: unknown[] = [], failure: unknown = null) {
  const queries: Array<{ table: string; filters: unknown[][] }> = [];
  const supabase = {
    from: vi.fn((table: string) => {
      const query = { table, filters: [] as unknown[][] };
      queries.push(query);
      const result = table === "tenant_categories" ? { data: category, error: null } : { data: rows, error: failure };
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => { query.filters.push(args); return chain; },
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    }),
  };
  return { supabase: supabase as never, queries };
}

describe("edition feature resolution", () => {
  it("accepts only supported edition tokens", () => {
    expect(parseEdition("smb")).toBe("smb");
    expect(parseEdition("staffing")).toBe("staffing");
    expect(parseEdition("enterprise")).toBeNull();
  });

  it.each([null, { category: "Staffing", edition_set_at: null }])("requires classification instead of trusting legacy defaults", async (category) => {
    const { supabase, queries } = client(category);
    await expect(loadTenantFeatures(supabase, "tenant-a")).rejects.toMatchObject({ code: "EDITION_UNCLASSIFIED", status: 409 });
    expect(queries).toHaveLength(1);
  });

  it("scopes category and effective features to the authorized tenant", async () => {
    const { supabase, queries } = client({ category: "SMB", edition_set_at: "2026-11-16" }, [
      { feature_key: "manage_clients", enabled: false }, { feature_key: "timesheets", enabled: true },
    ]);
    expect(await loadTenantFeatures(supabase, "tenant-a")).toEqual({ edition: "smb", features: { manage_clients: false, timesheets: true } });
    expect(queries.every((query) => query.filters.some(([key, value]) => key === "tenant_id" && value === "tenant-a"))).toBe(true);
  });

  it.each([{ rows: [] }, { rows: [{ feature_key: "bill_rates", enabled: false }] }])("denies disabled and unknown features", async ({ rows }) => {
    const { supabase } = client({ category: "Staffing", edition_set_at: "2026-11-16" }, rows);
    await expect(requireTenantFeature(supabase, "tenant-a", "bill_rates")).rejects.toMatchObject({ status: 403, code: "FEATURE_DISABLED" });
  });

  it("propagates database failures instead of guessing defaults", async () => {
    const { supabase } = client({ category: "SMB", edition_set_at: "2026-11-16" }, [], new Error("offline"));
    await expect(loadTenantFeatures(supabase, "tenant-a")).rejects.toThrow("offline");
  });

  it("allows a feature explicitly enabled by the resolved view", async () => {
    const { supabase } = client({ category: "SMB", edition_set_at: "2026-11-16" }, [{ feature_key: "bill_rates", enabled: true }]);
    await expect(requireTenantFeature(supabase, "tenant-a", "bill_rates")).resolves.toMatchObject({ edition: "smb" });
  });
});
