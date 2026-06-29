import { beforeEach, describe, expect, it, vi } from "vitest";

const inMock = vi.hoisted(() => vi.fn().mockReturnThis());
const rangeMock = vi.hoisted(() => vi.fn().mockReturnThis());
const orderMock = vi.hoisted(() => vi.fn().mockReturnThis());
const orMock = vi.hoisted(() => vi.fn().mockReturnThis());
const eqMock = vi.hoisted(() => vi.fn().mockReturnThis());
const selectMock = vi.hoisted(() =>
  vi.fn(() => ({
    eq: eqMock,
    or: orMock,
    order: orderMock,
    range: rangeMock,
    in: inMock,
  }))
);
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: vi.fn(async () => ({
    userId: "user-1",
    email: null,
    role: "admin",
    godAdmin: false,
    devBypass: true,
    authUser: { id: "user-1", app_metadata: { tenant_id: "tenant-a" } },
  })),
}));

vi.mock("@/lib/auth/staff-tenant-scope", () => ({
  resolveStaffTenantScope: vi.fn(async () => ({ mode: "scoped", tenantId: "tenant-a" })),
}));

vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabaseAnonKey: () => "anon-key",
}));

vi.mock("@/lib/applicant-portal/worker-profile-photo", () => ({
  attachWorkerProfilePhotoUrls: vi.fn(async (_sb, rows) => rows),
}));

import { attachWorkerProfilePhotoUrls } from "@/lib/applicant-portal/worker-profile-photo";
import { GET } from "@/app/api/workers/route";

describe("GET /api/workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    rangeMock.mockReturnValue({
      data: [{ id: "w1", status: "new", created_at: "2026-01-01", profile_photo: "x.jpg" }],
      error: null,
      count: 1,
    });
    inMock.mockReturnValue({
      data: [],
      error: null,
    });
  });

  it("uses Supabase range() instead of fetching all rows before slicing", async () => {
    const res = await GET(
      new Request("http://localhost/api/workers?limit=25&offset=50")
    );
    expect(res.status).toBe(200);
    expect(rangeMock).toHaveBeenCalledWith(50, 74);
    const json = await res.json();
    expect(json.limit).toBe(25);
    expect(json.offset).toBe(50);
    expect(json.hasMore).toBe(false);
    expect(json.workers).toHaveLength(1);
  });

  it("skips signed photo URLs unless includePhotoUrls=1", async () => {
    const res = await GET(new Request("http://localhost/api/workers?limit=10"));
    expect(res.status).toBe(200);
    expect(attachWorkerProfilePhotoUrls).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.workers[0].profile_photo_url).toBeNull();
  });
});
