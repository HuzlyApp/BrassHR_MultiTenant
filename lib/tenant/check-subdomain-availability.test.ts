import { describe, expect, it, vi } from "vitest";
import { checkSubdomainAvailabilityForOnboarding } from "./check-subdomain-availability";

function client(subdomainMatch: unknown, slugMatch: unknown) {
  let calls = 0;
  return { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: calls++ === 0 ? subdomainMatch : slugMatch, error: null }) }) }) })) };
}

describe("existing tenant domain availability", () => {
  it("accepts the tenant's existing address", async () => {
    const sb = client({ id: "tenant-a" }, { id: "tenant-a" });
    expect(await checkSubdomainAvailabilityForOnboarding(sb as never, "company-a", "tenant-a")).toEqual({ ok: true, subdomain: "company-a" });
  });
  it("rejects another tenant's slug even when it has no admin membership", async () => {
    const sb = client(null, { id: "tenant-b", subdomain: null });
    expect(await checkSubdomainAvailabilityForOnboarding(sb as never, "company-b", "tenant-a")).toHaveProperty("error");
  });
  it("rejects another tenant's subdomain", async () => {
    const sb = client({ id: "tenant-b" }, null);
    expect(await checkSubdomainAvailabilityForOnboarding(sb as never, "company-b", "tenant-a")).toHaveProperty("error");
  });
});
