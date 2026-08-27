import { describe, expect, it } from "vitest";
import {
  invitationRescheduleMessage,
  invitationSuccessMessage,
} from "@/lib/interviews/schedule-payload";

describe("interview invitation messages", () => {
  it("claims email delivery only when the invitation status is sent", () => {
    expect(
      invitationRescheduleMessage({
        sentCount: 1,
        failedCount: 0,
        skippedCount: 0,
        invitationStatus: "sent",
      })
    ).toMatch(/emails sent/i);

    expect(
      invitationRescheduleMessage({
        sentCount: 0,
        failedCount: 1,
        skippedCount: 0,
        invitationStatus: "failed",
      })
    ).not.toMatch(/emails sent/i);

    expect(
      invitationSuccessMessage({
        sentCount: 1,
        failedCount: 1,
        skippedCount: 0,
        invitationStatus: "partial",
      })
    ).toMatch(/could not be delivered/i);
  });
});
