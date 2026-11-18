import { describe, expect, it } from "vitest";
import {
  EMAIL_CHANGE_OTP_PURPOSE,
  normalizeAccountEmail,
  validateEmailChange,
} from "./email-change";

describe("email-change", () => {
  it("uses a distinct OTP purpose", () => {
    expect(EMAIL_CHANGE_OTP_PURPOSE).toBe("email_change");
  });

  it("normalizes email", () => {
    expect(normalizeAccountEmail("  Test@Example.COM ")).toBe("test@example.com");
  });

  it("requires a valid different email", () => {
    expect(validateEmailChange("", "a@b.com")).toBe("Enter a new email address.");
    expect(validateEmailChange("not-an-email", "a@b.com")).toBe("Enter a valid email address.");
    expect(validateEmailChange("a@b.com", "a@b.com")).toBe(
      "New email must be different from your current email."
    );
    expect(validateEmailChange("new@b.com", "a@b.com")).toBeNull();
  });
});
