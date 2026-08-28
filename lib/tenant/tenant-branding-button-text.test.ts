import { describe, expect, it } from "vitest";
import { sanitizeAuthButtonText } from "@/lib/tenant/tenant-branding";

describe("sanitizeAuthButtonText", () => {
  it("falls back when branding stored an email as the login CTA", () => {
    expect(sanitizeAuthButtonText("app@huzly.com")).toBe("Sign in");
  });

  it("keeps a normal CTA label", () => {
    expect(sanitizeAuthButtonText("Log in")).toBe("Log in");
  });
});
