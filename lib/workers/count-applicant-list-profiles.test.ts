import { describe, expect, it, vi } from "vitest";
import { countApplicantListProfiles } from "./count-unique-active-candidate-profiles";
describe("jobs dashboard applicant population", () => {
  it("uses the same tenant-scoped grouped total as the Applicants list", async () => {
    const rpc = vi.fn(async () => ({ data: { total: 33, applicants: [] }, error: null }));
    expect(await countApplicantListProfiles({ rpc } as never, "tenant-a")).toBe(33);
    expect(rpc).toHaveBeenCalledWith("staff_application_list_page", { p_tenant_id: "tenant-a", p_job_id: null, p_limit: 1, p_offset: 0 });
  });
  it("reports a count failure instead of silently displaying zero", async () => {
    await expect(countApplicantListProfiles({ rpc: async () => ({ data: null, error: new Error("Unavailable") }) } as never, "tenant-a")).rejects.toThrow("Unavailable");
  });
});
