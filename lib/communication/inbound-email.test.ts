import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordInboundCandidateEmail } from "@/lib/communication/inbound-email";

const resolveWorkerByEmail = vi.fn();
const recordCandidateCommunication = vi.fn();
const findCommunicationByProviderMessageId = vi.fn();

vi.mock("@/lib/communication/resolve-worker-by-email", () => ({
  resolveWorkerByEmail: (...args: unknown[]) => resolveWorkerByEmail(...args),
}));

vi.mock("@/lib/communication/record", () => ({
  recordCandidateCommunication: (...args: unknown[]) => recordCandidateCommunication(...args),
  findCommunicationByProviderMessageId: (...args: unknown[]) =>
    findCommunicationByProviderMessageId(...args),
}));

describe("recordInboundCandidateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordCandidateCommunication.mockResolvedValue({ id: "comm-1" });
    findCommunicationByProviderMessageId.mockResolvedValue(null);
  });

  it("records inbound email for worker matched via legacy domain", async () => {
    resolveWorkerByEmail.mockResolvedValue({
      id: "w1",
      tenant_id: "t1",
      email: "john@nexusmedpro.com",
    });

    const result = await recordInboundCandidateEmail({} as never, {
      from: "John <john@brasshr.com>",
      subject: "Re: Onboarding",
      body: "Thanks!",
      providerMessageId: "email-123",
    });

    expect(result).toEqual({ recorded: true, workerId: "w1" });
    expect(resolveWorkerByEmail).toHaveBeenCalledWith({}, "john@brasshr.com");
    expect(recordCandidateCommunication).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workerId: "w1",
        channel: "email",
        recipient: "john@brasshr.com",
        contactEmail: "john@brasshr.com",
        fromEmail: "john@brasshr.com",
        subject: "Re: Onboarding",
        body: "Thanks!",
        status: "received",
        direction: "inbound",
      })
    );
  });

  it("skips empty payloads", async () => {
    const result = await recordInboundCandidateEmail({} as never, {
      from: "",
      body: "",
    });
    expect(result).toEqual({ recorded: false, reason: "missing_from" });
    expect(resolveWorkerByEmail).not.toHaveBeenCalled();
  });

  it("records Re: subjects without filtering them out", async () => {
    resolveWorkerByEmail.mockResolvedValue({
      id: "w1",
      tenant_id: "t1",
      email: "clelipan@up.edu.ph",
    });

    await recordInboundCandidateEmail({} as never, {
      from: "clelipan@up.edu.ph",
      subject: "Re: bitch",
      body: "reply body",
      providerMessageId: "resend-email-id",
    });

    expect(recordCandidateCommunication).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        subject: "Re: bitch",
        status: "received",
        direction: "inbound",
      })
    );
  });

  it("does not record when no worker matches", async () => {
    resolveWorkerByEmail.mockResolvedValue(null);

    const result = await recordInboundCandidateEmail({} as never, {
      from: "unknown@gmail.com",
      body: "Hello",
    });

    expect(result).toEqual({ recorded: false, reason: "contact_not_found" });
    expect(recordCandidateCommunication).not.toHaveBeenCalled();
  });
});
