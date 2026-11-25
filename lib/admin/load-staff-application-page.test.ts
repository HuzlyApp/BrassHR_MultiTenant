import { describe, expect, it, vi } from "vitest";
import { loadStaffApplicationPage } from "./load-staff-application-page";

describe("applicant literal search", () => {
  it.each(["%_'\"<>;--", "---", " %_ "])("returns no matches for punctuation-only query %s", async (q) => {
    const db = { rpc: vi.fn(), from: vi.fn() };
    const result = await loadStaffApplicationPage(db as never, "tenant-a", new URLSearchParams({ q }));
    expect(result).toMatchObject({ total: 0, applications: [] });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("keeps whitespace-only search equivalent to clearing the search", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ids: [], total: 0, analyzedCount: 0 }, error: null });
    await loadStaffApplicationPage({ rpc } as never, "tenant-a", new URLSearchParams({ q: "  " }));
    expect(rpc).toHaveBeenCalledWith("staff_application_list_page", expect.objectContaining({ p_tenant_id: "tenant-a", p_query: null }));
  });
});
