import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const getCachedStaffApiSession = vi.fn();
const getCachedStaffTenantScope = vi.fn();
const getOrSetCache = vi.fn();
const invalidateUserCache = vi.fn();
const loadStaffUserProfileCached = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/auth/cached-staff-auth", () => ({
  getCachedStaffApiSession: (...args: unknown[]) => getCachedStaffApiSession(...args),
  getCachedStaffTenantScope: (...args: unknown[]) => getCachedStaffTenantScope(...args),
}));

vi.mock("@/lib/cache", () => ({
  buildCacheKey: (...parts: unknown[]) => parts.join(":"),
  CACHE_TTL_SECONDS: { userScoped: 600 },
  getOrSetCache: (...args: unknown[]) => getOrSetCache(...args),
  invalidateUserCache: (...args: unknown[]) => invalidateUserCache(...args),
}));

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: vi.fn(),
}));

vi.mock("@/lib/auth/staff-user-profile", () => ({
  loadStaffUserProfileCached: (...args: unknown[]) => loadStaffUserProfileCached(...args),
}));

vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

describe("GET /api/admin/header-data", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    getCachedStaffApiSession.mockResolvedValue({
      userId: "user-1",
      authUser: { id: "user-1", app_metadata: { tenant_id: "tenant-1" } },
    });
    getCachedStaffTenantScope.mockResolvedValue({ mode: "scoped", tenantId: "tenant-1" });
    loadStaffUserProfileCached.mockResolvedValue({
      god_admin: false,
      tenant_id: "tenant-1",
      role: "admin",
    });
    getOrSetCache.mockImplementation(async (_key: string, fetcher: () => Promise<unknown>) =>
      fetcher()
    );
  });

  it("loads header data successfully with profile fields", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "notifications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: "n1",
                      title: "Hello",
                      body: null,
                      type: "general",
                      link: "/x",
                      is_read: false,
                      sent_at: "2026-08-25T00:00:00.000Z",
                    },
                  ],
                  error: null,
                }),
              }),
              eq: () => ({
                // unread count branch uses head count
              }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  first_name: "Ada",
                  last_name: "Lovelace",
                  full_name: "Ada Lovelace",
                  email: "ada@example.com",
                  avatar_url: null,
                  role: "admin",
                  tenant_id: "tenant-1",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { name: "Acme" }, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    // More precise chained mock for notifications list + unread count
    const notificationsChain = {
      select: vi.fn(),
    };
    notificationsChain.select.mockImplementation((cols: string, opts?: { head?: boolean }) => {
      if (opts?.head) {
        return {
          eq: () => ({
            eq: async () => ({ count: 1, error: null }),
          }),
        };
      }
      return {
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                {
                  id: "n1",
                  title: "Hello",
                  body: null,
                  type: "general",
                  link: "/x",
                  is_read: false,
                  sent_at: "2026-08-25T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "notifications") return notificationsChain;
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  first_name: "Ada",
                  last_name: "Lovelace",
                  email: "ada@example.com",
                  role: "admin",
                  tenant_id: "tenant-1",
                  profile_photo: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { name: "Acme" }, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    const { GET } = await import("@/app/api/admin/header-data/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-1");
    expect(body.displayName).toBe("Ada Lovelace");
    expect(body.tenantName).toBe("Acme");
    expect(body.notifications).toHaveLength(1);
    expect(body.unreadNotifications).toBe(1);
    expect(body.correlationId).toBeTruthy();
  });

  it("does not return HTTP 500 when notifications.link is missing", async () => {
    let linkAttempt = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "notifications") {
        return {
          select: (cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: () => ({
                  eq: async () => ({ count: 0, error: null }),
                }),
              };
            }
            if (String(cols).includes("link") && linkAttempt === 0) {
              linkAttempt += 1;
              return {
                eq: () => ({
                  order: () => ({
                    limit: async () => ({
                      data: null,
                      error: { code: "42703", message: "column notifications.link does not exist" },
                    }),
                  }),
                }),
              };
            }
            return {
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "n2",
                        title: "Fallback",
                        body: null,
                        type: "general",
                        is_read: true,
                        sent_at: "2026-08-25T00:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  first_name: "Fallback",
                  last_name: "User",
                  email: "f@example.com",
                  role: "admin",
                  tenant_id: "tenant-1",
                  profile_photo: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "tenants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { name: "Acme" }, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({}) };
    });

    const { GET } = await import("@/app/api/admin/header-data/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.displayName).toBe("Fallback User");
    expect(body.notifications[0].title).toBe("Fallback");
    expect(body.notifications[0].link).toBeNull();
  });

  it("returns auth NextResponse when unauthenticated", async () => {
    getCachedStaffApiSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { GET } = await import("@/app/api/admin/header-data/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
