import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requireStaffApiSession = vi.fn();
const enforceRateLimit = vi.fn();
const dialpadApiKey = vi.fn();
const listDialpadUsers = vi.fn();
const initiateDialpadCall = vi.fn();

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: (...args: unknown[]) => requireStaffApiSession(...args),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
}));

vi.mock("@/lib/dialpad/client", () => ({
  DialpadError: class DialpadError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  dialpadApiKey: (...args: unknown[]) => dialpadApiKey(...args),
  listDialpadUsers: (...args: unknown[]) => listDialpadUsers(...args),
  initiateDialpadCall: (...args: unknown[]) => initiateDialpadCall(...args),
}));

const auth = {
  userId: "staff-1",
  email: "alex@example.com",
  role: "admin",
  godAdmin: false,
};

const callers = [
  {
    id: "4943251099926528",
    name: "Alex Recruiter",
    emails: ["alex@example.com"],
    phones: ["+14155550100"],
    online: true,
  },
];

describe("/api/admin/dialpad", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireStaffApiSession.mockResolvedValue(auth);
    enforceRateLimit.mockResolvedValue(null);
    dialpadApiKey.mockReturnValue("test-key");
    listDialpadUsers.mockResolvedValue(callers);
    initiateDialpadCall.mockResolvedValue({ callId: "99" });
  });

  it("selects the Dialpad user whose email matches the signed-in staff member", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/admin/dialpad"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      configured: true,
      defaultUserId: "4943251099926528",
    });
  });

  it("rings the selected user with an E.164 number", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/dialpad", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: "(415) 555-0134", userId: "4943251099926528" }),
      })
    );
    expect(response.status).toBe(200);
    expect(initiateDialpadCall).toHaveBeenCalledWith("test-key", {
      phoneNumber: "+14155550134",
      userId: "4943251099926528",
    });
  });

  it("rejects a number that cannot be dialed", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/dialpad", {
        method: "POST",
        body: JSON.stringify({ phoneNumber: "555", userId: "4943251099926528" }),
      })
    );
    expect(response.status).toBe(400);
    expect(initiateDialpadCall).not.toHaveBeenCalled();
  });

  it("returns the staff auth response unchanged", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    requireStaffApiSession.mockResolvedValue(denied);
    const { POST } = await import("./route");
    const response = await POST(new NextRequest("http://localhost/api/admin/dialpad", { method: "POST" }));
    expect(response.status).toBe(403);
  });
});
