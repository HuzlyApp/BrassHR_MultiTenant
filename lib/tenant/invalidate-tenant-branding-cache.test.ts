import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteCache = vi.hoisted(() => vi.fn(async () => undefined));
const deleteByPattern = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/cache", () => ({
  buildCacheKey: vi.fn(
    (_table: string, scope: string[], params?: unknown) =>
      `mock:${scope.join(":")}:${JSON.stringify(params ?? null)}`
  ),
  deleteCache,
  deleteByPattern,
}));

import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";

describe("invalidateTenantBrandingCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears tenant branding row cache and all admin effective-branding entries for the tenant", async () => {
    const tenantId = "tenant-123";
    await invalidateTenantBrandingCache(tenantId);

    expect(deleteCache).toHaveBeenCalledTimes(1);
    expect(deleteByPattern).toHaveBeenCalledWith(
      `supabase:admin_effective_branding:*:tenant:${tenantId}:*`
    );
  });
});
