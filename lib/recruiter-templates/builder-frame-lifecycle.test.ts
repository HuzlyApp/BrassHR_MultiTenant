import { describe, expect, it } from "vitest";
import {
  applyEditorInitTimeout,
  classifyTemplateBuilderError,
  isAllowedTemplateBuilderMessageOrigin,
  isBuilderSessionExpired,
  msUntilSessionExpiry,
  TEMPLATE_BUILDER_ERRORS,
  templateBuilderUserMessage,
} from "@/lib/recruiter-templates/builder-frame-lifecycle";

describe("builder-frame-lifecycle", () => {
  it("classifies expired sessions", () => {
    expect(classifyTemplateBuilderError("session expired")).toBe("session_expired");
    expect(templateBuilderUserMessage("session expired")).toBe(
      TEMPLATE_BUILDER_ERRORS.session_expired
    );
  });

  it("classifies missing templates and permissions", () => {
    expect(classifyTemplateBuilderError("not found", 404)).toBe("template_missing");
    expect(classifyTemplateBuilderError("denied", 403)).toBe("permission");
  });

  it("classifies CSP and ready failures", () => {
    expect(classifyTemplateBuilderError("Refused to frame by Content Security Policy")).toBe(
      "csp_blocked"
    );
    expect(classifyTemplateBuilderError("did not finish loading")).toBe("ready_timeout");
  });

  it("sanitizes provider messages for unknown failures", () => {
    const message = templateBuilderUserMessage("Firma API returned 502", 502, "abc-123");
    expect(message).toContain("Ref: abc-123");
    expect(message.toLowerCase()).not.toContain("firma");
  });

  it("computes absolute UTC expiration correctly across timezones", () => {
    const expiresAt = "2026-08-25T12:00:00.000Z";
    expect(isBuilderSessionExpired(expiresAt, Date.parse("2026-08-25T11:59:59.000Z"))).toBe(
      false
    );
    expect(isBuilderSessionExpired(expiresAt, Date.parse("2026-08-25T12:00:00.000Z"))).toBe(true);
    expect(msUntilSessionExpiry(expiresAt, Date.parse("2026-08-25T11:59:00.000Z"))).toBe(60_000);
  });

  it("ignores stale timeouts after ready", () => {
    expect(
      applyEditorInitTimeout({
        generation: 1,
        activeGeneration: 1,
        ready: true,
        cancelled: false,
      })
    ).toEqual({ shouldSetError: false });

    expect(
      applyEditorInitTimeout({
        generation: 1,
        activeGeneration: 2,
        ready: false,
        cancelled: false,
      })
    ).toEqual({ shouldSetError: false });

    expect(
      applyEditorInitTimeout({
        generation: 3,
        activeGeneration: 3,
        ready: false,
        cancelled: false,
      })
    ).toEqual({ shouldSetError: true });
  });

  it("accepts postMessage only from the expected provider origin", () => {
    expect(
      isAllowedTemplateBuilderMessageOrigin("https://app.example.com", "https://app.example.com")
    ).toBe(true);
    expect(
      isAllowedTemplateBuilderMessageOrigin("https://evil.example", "https://app.example.com")
    ).toBe(false);
    expect(isAllowedTemplateBuilderMessageOrigin("https://app.example.com", null)).toBe(false);
  });
});
