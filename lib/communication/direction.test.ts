import { describe, expect, it } from "vitest";
import { communicationDirectionFromRow } from "@/lib/communication/direction";

describe("communicationDirectionFromRow", () => {
  it("uses stored direction when present", () => {
    expect(communicationDirectionFromRow({ direction: "inbound" })).toBe("inbound");
    expect(communicationDirectionFromRow({ direction: "outbound" })).toBe("outbound");
  });

  it("treats recruiter-sent rows as outbound", () => {
    expect(
      communicationDirectionFromRow({
        sent_by_user_id: "user-1",
        subject: "Re: hello",
      })
    ).toBe("outbound");
  });

  it("treats applicant replies (Re: subject, no sender user) as inbound", () => {
    expect(
      communicationDirectionFromRow({
        sent_by_user_id: null,
        subject: "Re: bitch",
        channel: "email",
      })
    ).toBe("inbound");
  });
});
