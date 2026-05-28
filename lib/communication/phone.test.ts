import { describe, expect, it } from "vitest";
import { isValidE164, normalizePhoneToE164 } from "@/lib/communication/phone";

describe("normalizePhoneToE164", () => {
  it("normalizes 10-digit US numbers", () => {
    expect(normalizePhoneToE164("(555) 123-4567")).toBe("+15551234567");
  });

  it("accepts E.164 input", () => {
    expect(normalizePhoneToE164("+15551234567")).toBe("+15551234567");
  });

  it("rejects too short numbers", () => {
    expect(normalizePhoneToE164("12345")).toBeNull();
  });
});

describe("isValidE164", () => {
  it("validates E.164", () => {
    expect(isValidE164("+15551234567")).toBe(true);
    expect(isValidE164("555")).toBe(false);
  });
});
