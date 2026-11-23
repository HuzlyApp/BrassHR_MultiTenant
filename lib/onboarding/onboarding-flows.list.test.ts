import { describe, expect, it, vi } from "vitest";
import { listOnboardingFlows } from "./onboarding-flows";
vi.mock("./onboarding-libraries", () => ({ resolveOnboardingLibraryForFlows: async () => ({ id: "folder-a", name: "Custom folder", slug: "custom" }) }));
describe("workflow folder listing", () => {
  it("leaves an empty folder empty across repeated reads without provisioning flows", async () => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve) };
    const sb = { from: vi.fn(() => query) };
    for (let i = 0; i < 2; i++) {
      expect(await listOnboardingFlows(sb as never, "tenant-a", { libraryId: "folder-a" })).toMatchObject({ flows: [], publishedCount: 0, unpublishedCount: 0 });
    }
    expect(sb.from).toHaveBeenCalledTimes(2);
    expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(query.eq).toHaveBeenCalledWith("library_id", "folder-a");
  });
});
