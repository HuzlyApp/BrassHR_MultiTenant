import { describe, expect, it, vi } from "vitest";
import { parseIndustryMetadata, removeTenantIndustry, saveIndustryMetadata } from "./industry-settings";
const mocks = vi.hoisted(() => ({ bind: vi.fn() }));
vi.mock("@/lib/ai-catalog/bind-tenant", () => ({ bindTenantIndustries: mocks.bind }));
function database(options: { missing?: boolean; count?: number } = {}) {
  const filters: unknown[][] = [], update = vi.fn();
  const from = (table: string) => {
    const query = { select: () => query, update: (value: unknown) => { update(value); return query; }, eq: (key: string, value: unknown) => { filters.push([table, key, value]); return query; },
      maybeSingle: async () => ({ data: table === "tenants" ? { primary_industry_key: "healthcare" } : options.missing ? null : { industry_key: "other", description: "Saved description", icon_id: "code" }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ industry_key: "healthcare", is_primary: true }, { industry_key: "other", is_primary: false }], count: options.count ?? 0, error: null }).then(resolve) };
    return query;
  }; return { sb: { from }, filters, update };
}
describe("tenant industry settings", () => {
  it("persists metadata in the authenticated tenant and returns the stored fields", async () => {
    const db = database();
    expect(await saveIndustryMetadata(db.sb as never, "tenant-a", "other", { description: " Saved description ", iconId: "code" })).toMatchObject({ description: "Saved description" });
    expect(db.update).toHaveBeenCalledWith({ description: "Saved description", icon_id: "code" });
    expect(db.filters).toContainEqual(["tenant_industry", "tenant_id", "tenant-a"]);
    expect(db.filters).toContainEqual(["tenant_industry", "industry_key", "other"]);
  });
  it("rejects saving an industry not owned by the tenant", async () => {
    const db = database({ missing: true });
    await expect(saveIndustryMetadata(db.sb as never, "tenant-a", "other", {})).rejects.toMatchObject({ status: 404 });
  });
  it("rejects oversized descriptions and unknown icons", () => {
    expect(() => parseIndustryMetadata({ description: "x".repeat(101) })).toThrow(/100 characters/);
    expect(() => parseIndustryMetadata({ iconId: "invalid" })).toThrow(/valid industry icon/);
  });
  it("allows clearing a saved description and icon", () => {
    expect(parseIndustryMetadata({ description: " ", iconId: null })).toEqual({ description: null, icon_id: null });
  });
  it("protects the primary industry", async () => {
    const db = database(); await expect(removeTenantIndustry(db.sb as never, "tenant-a", "healthcare")).rejects.toMatchObject({ status: 409 });
  });
  it("protects industries with professions", async () => {
    const db = database({ count: 1 }); await expect(removeTenantIndustry(db.sb as never, "tenant-a", "other")).rejects.toMatchObject({ status: 409 });
    expect(db.filters).toContainEqual(["tenant_professions", "tenant_id", "tenant-a"]);
  });
  it("removes only the empty secondary industry while preserving primary bindings", async () => {
    const db = database(); await removeTenantIndustry(db.sb as never, "tenant-a", "other");
    expect(mocks.bind).toHaveBeenCalledWith(db.sb, { tenantId: "tenant-a", industryKeys: ["healthcare"], primaryIndustryKey: "healthcare" });
  });
});
