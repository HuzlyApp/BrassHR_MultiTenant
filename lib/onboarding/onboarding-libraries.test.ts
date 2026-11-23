import { describe, expect, it, vi } from "vitest";
import { manageOnboardingLibrary } from "./onboarding-libraries";
function database(options: { missing?: boolean; slug?: string; count?: number } = {}) {
  const mutations: Array<{ method: string; value?: unknown }> = [], filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([table, key, value]); return query; },
      update: (value: unknown) => { mutations.push({ method: "update", value }); return query; },
      delete: () => { mutations.push({ method: "delete" }); return query; },
      maybeSingle: async () => ({ data: options.missing ? null : { id: "folder", slug: options.slug ?? "custom", is_uncategorized: false }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ count: options.count ?? 0, error: null }).then(resolve),
    }; return query;
  }); return { sb: { from }, mutations, filters };
}
describe("workflow folder management", () => {
  it("renames only the selected tenant folder", async () => {
    const db = database(); await manageOnboardingLibrary(db.sb as never, "tenant-a", "folder", { name: " Renamed " });
    expect(db.mutations[0]).toMatchObject({ method: "update", value: { name: "Renamed" } });
    expect(db.filters).toContainEqual(["onboarding_libraries", "tenant_id", "tenant-a"]);
    expect(db.filters).toContainEqual(["onboarding_libraries", "id", "folder"]);
  });
  it("rejects an unknown or foreign tenant folder", async () => {
    const db = database({ missing: true });
    await expect(manageOnboardingLibrary(db.sb as never, "tenant-a", "foreign", { delete: true })).rejects.toMatchObject({ status: 404 });
    expect(db.mutations).toHaveLength(0);
  });
  it("protects default folders from rename and deletion", async () => {
    const db = database({ slug: "onboarding" });
    await expect(manageOnboardingLibrary(db.sb as never, "tenant-a", "folder", { delete: true })).rejects.toMatchObject({ status: 409 });
    expect(db.mutations).toHaveLength(0);
  });
  it("preserves workflows in nonempty folders", async () => {
    const db = database({ count: 2 });
    await expect(manageOnboardingLibrary(db.sb as never, "tenant-a", "folder", { delete: true })).rejects.toMatchObject({ status: 409 });
    expect(db.mutations).toHaveLength(0);
  });
  it("deletes an empty custom folder with tenant scope", async () => {
    const db = database(); await manageOnboardingLibrary(db.sb as never, "tenant-a", "folder", { delete: true });
    expect(db.mutations).toEqual([{ method: "delete" }]);
    expect(db.filters).toContainEqual(["onboarding_flows", "tenant_id", "tenant-a"]);
  });
  it("rejects blank names before updating", async () => {
    const db = database(); await expect(manageOnboardingLibrary(db.sb as never, "tenant-a", "folder", { name: " " })).rejects.toMatchObject({ status: 400 });
    expect(db.mutations).toHaveLength(0);
  });
});
