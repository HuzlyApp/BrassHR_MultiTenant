import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
    constructor(_apiKey: string) {}
  },
}));

vi.mock("@/lib/communication/env", () => ({
  requireResendConfig: () => ({
    apiKey: "re_test",
    fromHeader: "Brass HR <notifications@brasshr.com>",
    replyTo: "support@brasshr.com",
  }),
}));

import { sendCandidateEmail } from "@/lib/communication/send-candidate-email";

describe("sendCandidateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });
  });

  it("delivers to migrated @brasshr.com address", async () => {
    const result = await sendCandidateEmail({
      to: "john@brasshr.com",
      subject: "Welcome",
      body: "Hello John",
    });

    expect(result).toEqual({ ok: true, messageId: "msg-1" });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "john@brasshr.com",
        from: "Brass HR <notifications@brasshr.com>",
        subject: "Welcome",
      })
    );
  });

  it("does not alter unrelated recipient domains", async () => {
    await sendCandidateEmail({
      to: "jane@gmail.com",
      subject: "Hello",
      body: "Hi",
    });

    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@gmail.com" }));
  });
});
