import { describe, expect, it } from "vitest";
import {
  PHONE_CHANGE_OTP_PURPOSE,
  normalizeAccountPhone,
  validatePhoneChange,
} from "./phone-change";

describe("phone-change", () => {
  it("uses a distinct OTP purpose", () => {
    expect(PHONE_CHANGE_OTP_PURPOSE).toBe("phone_change");
  });

  it("normalizes phone numbers", () => {
    expect(normalizeAccountPhone("5551234567")).toBe("(555) 123-4567");
  });

  it("requires a valid different phone", () => {
    expect(validatePhoneChange("", "(555) 123-4567")).toBe("Enter a phone number to continue.");
    expect(validatePhoneChange("5551234567", "(555) 123-4567")).toBe(
      "New phone number must be different from your current phone number."
    );
    expect(validatePhoneChange("5559876543", "(555) 123-4567")).toBeNull();
  });
});
