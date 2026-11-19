import { describe, expect, it } from "vitest";
import {
  buildSupportTicketNumber,
  formatSupportTicketNumber,
} from "@/lib/support-tickets/ticket-number";

describe("buildSupportTicketNumber", () => {
  it("formats first seven hex chars as XX-XXXXX", () => {
    expect(buildSupportTicketNumber("23f5b18a-1111-2222-3333-444444444444")).toBe("23-F5B18");
  });
});

describe("formatSupportTicketNumber", () => {
  it("prefixes stored values with #", () => {
    expect(formatSupportTicketNumber("23-F5B18")).toBe("#23-F5B18");
    expect(formatSupportTicketNumber("#23-f5b18")).toBe("#23-F5B18");
  });

  it("falls back to id-derived number when missing", () => {
    expect(
      formatSupportTicketNumber(null, "23f5b18a-1111-2222-3333-444444444444")
    ).toBe("#23-F5B18");
  });
});
