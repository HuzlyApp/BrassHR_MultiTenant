import { describe, expect, it } from "vitest";
import {
  eSignatureStatusLabel,
  sanitizeESignatureUserMessage,
} from "@/lib/e-signature/user-facing";

describe("eSignatureStatusLabel", () => {
  it("maps provider statuses to product labels", () => {
    expect(eSignatureStatusLabel("signed")).toBe("Signed");
    expect(eSignatureStatusLabel("completed")).toBe("Signed");
    expect(eSignatureStatusLabel("expired")).toBe("Expired");
    expect(eSignatureStatusLabel("cancelled")).toBe("Canceled");
    expect(eSignatureStatusLabel("draft")).toBe("Signature Pending");
  });
});

describe("sanitizeESignatureUserMessage", () => {
  it("removes provider names and hosts from user-visible errors", () => {
    expect(
      sanitizeESignatureUserMessage("Firma API returned 401 from https://api.firma.dev/x")
    ).not.toMatch(/firma/i);
    expect(
      sanitizeESignatureUserMessage("Failed to create Firma signing request")
    ).toMatch(/e-signature/i);
    expect(sanitizeESignatureUserMessage("FIRMA_API_KEY missing")).not.toMatch(/FIRMA_API_KEY/);
  });

  it("falls back when the message is empty", () => {
    expect(sanitizeESignatureUserMessage("")).toMatch(/temporarily unavailable/i);
  });
});
