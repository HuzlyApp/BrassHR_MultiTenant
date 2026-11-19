import { describe, expect, it } from "vitest";
import { validateTicketSubjectAndMessage } from "@/lib/support-tickets/ticket-field-validation";

describe("validateTicketSubjectAndMessage", () => {
  it("requires subject with at least two words", () => {
    expect(
      validateTicketSubjectAndMessage({
        subject: "Help",
        description: "Need help with payroll issue today.",
      })
    ).toEqual({
      subject: "Subject must contain at least two words.",
    });
    expect(
      validateTicketSubjectAndMessage({
        subject: "",
        description: "Need help with payroll issue today.",
      })
    ).toEqual({
      subject: "Subject is required.",
    });
  });

  it("requires message with at least five words", () => {
    expect(
      validateTicketSubjectAndMessage({
        subject: "Payroll issue",
        description: "Need help now",
      })
    ).toEqual({
      description: "Message must contain at least five words.",
    });
    expect(
      validateTicketSubjectAndMessage({
        subject: "Payroll issue",
        description: "",
      })
    ).toEqual({
      description: "Message is required.",
    });
  });

  it("passes valid subject and message", () => {
    expect(
      validateTicketSubjectAndMessage({
        subject: "Payroll issue",
        description: "Need help with payroll issue today please.",
      })
    ).toEqual({});
  });
});
