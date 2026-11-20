import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTenantDomain } from "./vercel";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("tenant domain registration", () => {
  it.each(["https://brasshr-devmode.vercel.app", "http://localhost:3000"])("skips custom-domain registration on %s even with credentials configured", async (origin) => {
    vi.stubEnv("VERCEL_TOKEN", "test-token");
    vi.stubEnv("VERCEL_PROJECT_ID", "development-project");
    vi.stubEnv("VERCEL_TEAM_ID", "test-team");
    vi.stubEnv("ROOT_DOMAIN", "brasshr.com");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await registerTenantDomain("example", { origin })).toMatchObject({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("registers production subdomains with the configured Vercel project", async () => {
    vi.stubEnv("VERCEL_TOKEN", "test-token");
    vi.stubEnv("VERCEL_PROJECT_ID", "production-project");
    vi.stubEnv("VERCEL_TEAM_ID", "test-team");
    vi.stubEnv("ROOT_DOMAIN", "brasshr.com");
    const fetch = vi.fn(async () => Response.json({ name: "example.brasshr.com", verified: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await registerTenantDomain("example", { origin: "https://brasshr.com" })).toMatchObject({ skipped: false });
    expect(fetch).toHaveBeenCalledWith("https://api.vercel.com/v10/projects/production-project/domains?teamId=test-team", expect.objectContaining({ body: JSON.stringify({ name: "example.brasshr.com" }) }));
  });
});
