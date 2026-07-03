import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);
const persistWorkerRowMock = vi.hoisted(() => vi.fn());
const sendProfileSaveStatusLinkEmailMock = vi.hoisted(() => vi.fn());
const resolveOnboardingTenantIdMock = vi.hoisted(() => vi.fn());
const resolveAppOriginMock = vi.hoisted(() => vi.fn());

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => Promise<void> | void) => {
      afterCallbacks.push(fn);
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/supabase-env", () => ({
  getSupabaseUrl: vi.fn(() => "https://example.supabase.co"),
}));

vi.mock("@/lib/onboarding/persist-worker-row", () => ({
  persistWorkerRow: (...args: unknown[]) => persistWorkerRowMock(...args),
}));

vi.mock("@/lib/onboarding/send-profile-save-status-link-email", () => ({
  sendProfileSaveStatusLinkEmail: (...args: unknown[]) =>
    sendProfileSaveStatusLinkEmailMock(...args),
}));

vi.mock("@/lib/tenant/resolve-onboarding-tenant-id", () => ({
  resolveOnboardingTenantId: (...args: unknown[]) => resolveOnboardingTenantIdMock(...args),
}));

vi.mock("@/lib/resolve-app-origin", () => ({
  resolveAppOrigin: (...args: unknown[]) => resolveAppOriginMock(...args),
}));

const validBody = {
  applicantId: "auth-user-1",
  firstName: "Jane",
  lastName: "Doe",
  address1: "123 Main St",
  address2: "123 Main St",
  city: "Austin",
  state: "Texas",
  zipCode: "78701",
  phone: "5125550100",
  email: "jane@example.com",
  jobRole: "RN",
};

async function saveWorker(body: Record<string, unknown> = validBody) {
  const { POST } = await import("@/app/api/onboarding/save-worker/route");
  return POST(
    new Request("https://tenant.example.com/api/onboarding/save-worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("onboarding save-worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://tenant.example.com";
    persistWorkerRowMock.mockResolvedValue({ ok: true, workerId: "worker-1" });
    resolveOnboardingTenantIdMock.mockResolvedValue({ ok: true, tenantId: "tenant-1" });
    resolveAppOriginMock.mockReturnValue("https://tenant.example.com");
    sendProfileSaveStatusLinkEmailMock.mockResolvedValue({ outcome: "sent", messageId: "msg-1" });
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns ok after profile save and schedules status link email", async () => {
    const res = await saveWorker();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(persistWorkerRowMock).toHaveBeenCalled();

    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(sendProfileSaveStatusLinkEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workerId: "worker-1",
        tenantId: "tenant-1",
        recipientEmail: "jane@example.com",
        origin: "https://tenant.example.com",
      })
    );
  });

  it("does not schedule email when profile save fails", async () => {
    persistWorkerRowMock.mockResolvedValue({
      ok: false,
      error: "Duplicate email",
      code: "DUPLICATE_EMAIL",
      status: 409,
    });

    const res = await saveWorker();
    expect(res.status).toBe(409);
    expect(afterCallbacks).toHaveLength(0);
    expect(sendProfileSaveStatusLinkEmailMock).not.toHaveBeenCalled();
  });

  it("still returns ok when status link email fails in after()", async () => {
    sendProfileSaveStatusLinkEmailMock.mockResolvedValue({
      outcome: "failed",
      reason: "SMTP down",
    });

    const res = await saveWorker();
    expect(res.status).toBe(200);
    await afterCallbacks[0]();
    expect(sendProfileSaveStatusLinkEmailMock).toHaveBeenCalled();
  });
});
