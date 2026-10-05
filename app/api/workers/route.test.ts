import { beforeEach, describe, expect, it, vi } from "vitest";

const inMock = vi.hoisted(() => vi.fn());
const rangeMock = vi.hoisted(() => vi.fn());
const orderMock = vi.hoisted(() => vi.fn());
const orMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

function makeBuilder(result: { data: unknown; error: null; count?: number }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = eqMock.mockImplementation(self);
  builder.or = orMock.mockImplementation(self);
  builder.order = orderMock.mockImplementation(self);
  builder.range = rangeMock.mockImplementation(self);
  builder.in = inMock.mockImplementation(self);
  builder.not = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.then = (
    onFulfilled: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock, rpc: vi.fn(async () => ({ data: null, error: { message: "no rpc" } })) })),
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
    const workerRow = {
      id: "w1",
      status: "new",
      created_at: "2026-01-01",
      profile_photo: "x.jpg",
      email: "a@example.com",
      phone: "5551112222",
      first_name: "Ada",
      last_name: "Lovelace",
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "worker") {
        return makeBuilder({ data: [workerRow], error: null, count: 1 });
      }
      return makeBuilder({ data: [], error: null });
    });
  });

  it("returns 503 when search is active but RPC is unavailable", async () => {
    const res = await GET(new Request("http://localhost/api/workers?q=shawnda&limit=25"));
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(0);
    expect(json.workers).toBeUndefined();
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
