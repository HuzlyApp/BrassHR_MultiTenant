import { describe, expect, it, vi } from "vitest";
import { fetchTenantVanityLabel } from "./recruiter-dashboard-redirect";

describe("recruiter domain activation", () => {
  it.each([null, "test.brasshr.com"])("redirects only when the reserved domain is active (%s)", async (domain) => {
    const rpc = vi.fn(async () => ({data:{slug:"test-company",subdomain:"test",domain},error:null}));
    const sb = { rpc };
    expect(await fetchTenantVanityLabel(sb as never, "tenant-a")).toBe(domain ? "test" : null);
    expect(rpc).toHaveBeenCalledWith("public_tenant_branding", {p_kind:"tenantId",p_value:"tenant-a"});
  });
});
