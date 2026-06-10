import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractInboundEmailBody } from "@/lib/communication/extract-inbound-body";
import { recordInboundCandidateEmail } from "@/lib/communication/inbound-email";

const receivingGet = vi.fn();
const verify = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify };
    emails = { receiving: { get: receivingGet } };
    constructor(_key: string) {}
  },
}));

vi.mock("@/lib/communication/inbound-email", () => ({
  recordInboundCandidateEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({}),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: async () => null,
  getClientIp: () => "127.0.0.1",
}));

import { POST } from "@/app/api/resend/inbound/route";

describe("Resend inbound webhook POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_ALLOW_UNSIGNED_WEBHOOKS = "true";
    process.env.NODE_ENV = "development";
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.RESEND_WEBHOOK_SECRET;

    receivingGet.mockResolvedValue({
      data: { text: "Thanks for the update", html: null, subject: "Re: bitch" },
      error: null,
    });
    vi.mocked(recordInboundCandidateEmail).mockResolvedValue({
      recorded: true,
      workerId: "55222b69-9839-4b9b-9642-be80a0ea58e5",
    });
  });

  it("processes email.received and persists by sender email", async () => {
    const payload = {
      type: "email.received",
      data: {
        email_id: "56761188-7520-42d8-8898-ff6fc54ce618",
        from: "clelipan@up.edu.ph",
        to: ["notifications@brasshr.com"],
        subject: "Re: bitch",
        message_id: "<test@mail>",
      },
    };

    const req = new Request("http://localhost/api/resend/inbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, recorded: true });
    expect(receivingGet).toHaveBeenCalledWith("56761188-7520-42d8-8898-ff6fc54ce618");
    expect(recordInboundCandidateEmail).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        from: "clelipan@up.edu.ph",
        subject: "Re: bitch",
        body: "Thanks for the update",
        providerMessageId: "56761188-7520-42d8-8898-ff6fc54ce618",
      })
    );
  });
});

describe("extractInboundEmailBody for replies", () => {
  it("keeps Re: subjects when body is missing", () => {
    expect(extractInboundEmailBody({ text: null, html: null, subject: "" }, "Re: bitch")).toContain(
      "Re: bitch"
    );
  });
});
