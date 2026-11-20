import { describe, expect, it, vi } from "vitest";
import { fetchTenantVanityLabel } from "./recruiter-dashboard-redirect";

describe("recruiter domain activation", () => {
  it.each([null, "test.brasshr.com"])("redirects only when the reserved domain is active (%s)", async (domain) => {
    const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: { slug: "test-company", subdomain: "test", domain }, error: null }) }));
    const sb = { from: () => ({ select: () => ({ eq }) }) };
    expect(await fetchTenantVanityLabel(sb as never, "tenant-a")).toBe(domain ? "test" : null);
    expect(eq).toHaveBeenCalledWith("id", "tenant-a");
  });
});
