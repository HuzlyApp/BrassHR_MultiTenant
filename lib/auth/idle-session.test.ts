import { describe, expect, it } from "vitest";
import {
  IDLE_TIMEOUT_MS,
  idleLogoutRedirectPath,
  isIdleSessionExpired,
  parseLastActivityMs,
} from "@/lib/auth/idle-session";

describe("parseLastActivityMs", () => {
  it("parses valid timestamps", () => {
    expect(parseLastActivityMs("1710000000000")).toBe(1710000000000);
  });

  it("rejects empty or invalid values", () => {
    expect(parseLastActivityMs(null)).toBeNull();
    expect(parseLastActivityMs("")).toBeNull();
    expect(parseLastActivityMs("abc")).toBeNull();
    expect(parseLastActivityMs("0")).toBeNull();
    expect(parseLastActivityMs("-1")).toBeNull();
  });
});

describe("isIdleSessionExpired", () => {
  const now = 1_700_000_000_000;

  it("is false when no activity has been recorded yet", () => {
    expect(isIdleSessionExpired(null, now)).toBe(false);
  });

  it("is false inside the idle window", () => {
    expect(isIdleSessionExpired(now - IDLE_TIMEOUT_MS + 1, now)).toBe(false);
  });

  it("is true after the idle window", () => {
    expect(isIdleSessionExpired(now - IDLE_TIMEOUT_MS - 1, now)).toBe(true);
  });
});

describe("idleLogoutRedirectPath", () => {
  it("sends applicants to worker sign-in", () => {
    expect(idleLogoutRedirectPath("/application/home")).toBe("/worker-signin?error=idle");
    expect(idleLogoutRedirectPath("/worker-onboarding")).toBe("/worker-signin?error=idle");
  });

  it("sends staff to admin login", () => {
    expect(idleLogoutRedirectPath("/admin_recruiter/dashboard")).toBe("/admin?error=idle");
    expect(idleLogoutRedirectPath("/godadmin/tenants")).toBe("/admin?error=idle");
  });
});
