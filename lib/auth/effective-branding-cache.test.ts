import { describe, expect, it } from "vitest";
import { buildCacheKey } from "@/lib/cache";

describe("effective-branding cache keys", () => {
  it("includes user id and tenant scope in the cache key", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const tenantId = "22222222-2222-2222-2222-222222222222";
    const key = buildCacheKey(
      "admin_effective_branding",
      ["user", userId, "tenant", tenantId],
      { fields: "branding+viewer" },
    );
    expect(key).toContain("admin_effective_branding");
    expect(key).toContain(userId);
    expect(key).toContain(tenantId);
  });

  it("uses tenant:none for unscoped god-admin sessions", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const key = buildCacheKey(
      "admin_effective_branding",
      ["user", userId, "tenant", "none"],
      { fields: "branding+viewer" },
    );
    expect(key).toContain("tenant:none");
  });
});
