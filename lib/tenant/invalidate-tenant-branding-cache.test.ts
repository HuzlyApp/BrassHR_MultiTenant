import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteCache = vi.hoisted(() => vi.fn(async () => undefined));
const deleteByPattern = vi.hoisted(() => vi.fn(async () => undefined));

/** Simulated DB rows — any tenant id maps to its own slug/subdomain (not one fixed company). */
const tenantRowsById = vi.hoisted(() =>
  new Map<string, { slug: string; subdomain: string }>([
    ["11111111-1111-1111-1111-111111111111", { slug: "acme-health", subdomain: "acme" }],
    ["22222222-2222-2222-2222-222222222222", { slug: "sunrise-care", subdomain: "sunrise" }],
  ])
);

const maybeSingle = vi.hoisted(() =>
  vi.fn(async () => {
    const tenantId = eqArg;
    const row = tenantRowsById.get(tenantId);
    return { data: row ?? null };
  })
);

let eqArg = "";

vi.mock("@/lib/cache", () => ({
  buildCacheKey: vi.fn(
    (_table: string, scope: string[], params?: unknown) =>
      `mock:${scope.join(":")}:${JSON.stringify(params ?? null)}`
  ),
  deleteCache,
  deleteByPattern,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_column: string, tenantId: string) => {
          eqArg = tenantId;
          return { maybeSingle };
        }),
      })),
    })),
  })),
}));

import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";

describe("invalidateTenantBrandingCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqArg = "";
  });

  it.each([
    {
      label: "company A",
      tenantId: "11111111-1111-1111-1111-111111111111",
      slug: "acme-health",
      subdomain: "acme",
    },
    {
      label: "company B",
      tenantId: "22222222-2222-2222-2222-222222222222",
      slug: "sunrise-care",
      subdomain: "sunrise",
    },
  ])(
    "clears caches for $label using its slug and subdomain",
    async ({ tenantId, slug, subdomain }) => {
      await invalidateTenantBrandingCache({ tenantId, slug, subdomain });

      expect(deleteCache).toHaveBeenCalledTimes(1);
      expect(deleteByPattern).toHaveBeenCalledWith(
        `supabase:admin_effective_branding:*:tenant:${tenantId}:*`
      );
      expect(deleteByPattern).toHaveBeenCalledWith(
        `supabase:tenant_branding:tenantId:${tenantId}:*`
      );
      expect(deleteByPattern).toHaveBeenCalledWith(`supabase:tenant_branding:slug:${slug}:*`);
      expect(deleteByPattern).toHaveBeenCalledWith(
        `supabase:tenant_branding:subdomain:${subdomain}:*`
      );
      expect(maybeSingle).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: "company A",
      tenantId: "11111111-1111-1111-1111-111111111111",
      slug: "acme-health",
      subdomain: "acme",
    },
    {
      label: "company B",
      tenantId: "22222222-2222-2222-2222-222222222222",
      slug: "sunrise-care",
      subdomain: "sunrise",
    },
  ])(
    "loads slug and subdomain from the database when only tenant id is provided ($label)",
    async ({ tenantId, slug, subdomain }) => {
      await invalidateTenantBrandingCache(tenantId);

      expect(maybeSingle).toHaveBeenCalled();
      expect(deleteByPattern).toHaveBeenCalledWith(`supabase:tenant_branding:slug:${slug}:*`);
      expect(deleteByPattern).toHaveBeenCalledWith(
        `supabase:tenant_branding:subdomain:${subdomain}:*`
      );
    }
  );
});
