import { describe, expect, it } from "vitest";
import { PASSWORD_CHANGE_OTP_PURPOSE, PASSWORD_CHANGE_OTP_SUBJECT } from "./password-change-otp";

describe("password-change-otp", () => {
  it("uses a distinct OTP purpose from login", () => {
    expect(PASSWORD_CHANGE_OTP_PURPOSE).toBe("password_change");
    expect(PASSWORD_CHANGE_OTP_PURPOSE).not.toBe("login");
  });

  it("uses a password-change email subject", () => {
    expect(PASSWORD_CHANGE_OTP_SUBJECT.toLowerCase()).toContain("password");
  });
});
