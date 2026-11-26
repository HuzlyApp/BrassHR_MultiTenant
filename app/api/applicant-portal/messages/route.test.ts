import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  applicant: vi.fn(),
  staff: vi.fn(),
  service: vi.fn(),
  scope: vi.fn(),
  access: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/applicant-portal/request", () => ({
  requireApprovedApplicant: mocks.applicant,
}));
vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: mocks.staff,
}));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({
  resolveStaffTenantScope: mocks.scope,
}));
vi.mock("@/lib/auth/worker-record-access", () => ({
  canAccessWorkerRecord: mocks.access,
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: mocks.service,
}));
vi.mock("@/lib/messaging/message-notifications", () => ({
  notifyDirectMessage: mocks.notify,
}));
import { GET, POST } from "./route";

const workerId = "11111111-1111-4111-8111-111111111111";
function request(body: object) {
  return new NextRequest(
    "https://clinic.example.com/api/applicant-portal/messages",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
function database(fail = false) {
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => ({ data: [], error: null })),
    maybeSingle: vi.fn(async () => ({
      data: { id: workerId, user_id: "applicant", tenant_id: "tenant" },
      error: null,
    })),
    single: vi.fn(async () => ({
      data: { id: "msg", sender_role: "applicant", body: "Hello" },
      error: fail ? new Error("Insert failed") : null,
    })),
  };
  return { from: vi.fn(() => query), query };
}

describe("direct message API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notify.mockResolvedValue(undefined);
  });

  it("sends an applicant reply and notifies staff after saving", async () => {
    const db = database();
    mocks.applicant.mockResolvedValue({
      supabase: db,
      applicant: { id: workerId, tenant_id: "tenant" },
      user: { id: "applicant" },
    });
    const response = await POST(request({ body: "Hello" }));
    expect(response.status).toBe(200);
    expect(db.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: "tenant",
        worker_id: workerId,
        sender_user_id: "applicant",
      }),
    );
    expect(mocks.notify).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tenantId: "tenant",
        senderRole: "applicant",
        senderUserId: "applicant",
        body: "Hello",
      }),
    );
  });

  it("sends an admin message to the validated worker's tenant", async () => {
    const db = database();
    mocks.staff.mockResolvedValue({
      userId: "admin",
      authUser: {},
      devBypass: false,
    });
    mocks.service.mockReturnValue(db);
    mocks.access.mockResolvedValue(true);
    mocks.scope.mockResolvedValue({ mode: "scoped", tenantId: "tenant" });
    expect((await POST(request({ workerId, body: "Hello" }))).status).toBe(200);
    expect(mocks.notify).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        tenantId: "tenant",
        workerId,
        senderRole: "recruiter",
        senderUserId: "admin",
      }),
    );
  });

  it("rejects another tenant's worker without saving or notifying", async () => {
    const db = database();
    mocks.staff.mockResolvedValue({ userId: "admin", authUser: {} });
    mocks.service.mockReturnValue(db);
    mocks.access.mockResolvedValue(true);
    mocks.scope.mockResolvedValue({ mode: "scoped", tenantId: "other" });
    expect((await POST(request({ workerId, body: "Hello" }))).status).toBe(403);
    expect(db.query.insert).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("returns portal auth failures without sending", async () => {
    mocks.applicant.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await POST(request({ body: "Hello" }))).status).toBe(401);
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("does not notify when saving fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.applicant.mockResolvedValue({
      supabase: database(true),
      applicant: { id: workerId, tenant_id: "tenant" },
      user: { id: "applicant" },
    });
    expect((await POST(request({ body: "Hello" }))).status).toBe(500);
    expect(mocks.notify).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("scopes portal message reads to the resolved tenant and worker", async () => {
    const db = database();
    mocks.applicant.mockResolvedValue({
      supabase: db,
      applicant: { id: workerId, tenant_id: "tenant" },
      user: { id: "applicant" },
    });
    expect(
      (
        await GET(
          new NextRequest(
            "https://clinic.example.com/api/applicant-portal/messages",
          ),
        )
      ).status,
    ).toBe(200);
    expect(db.query.eq).toHaveBeenCalledWith("tenant_id", "tenant");
    expect(db.query.eq).toHaveBeenCalledWith("worker_id", workerId);
  });
});
