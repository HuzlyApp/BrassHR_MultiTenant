import { describe, expect, it } from "vitest";
import {
  buildForgotPasswordHref,
  buildPostResetSignInHref,
  safePasswordResetReturnPath,
} from "./password-reset-return";

describe("password-reset-return", () => {
  it("allows worker and admin return paths", () => {
    expect(safePasswordResetReturnPath("/worker-signin")).toBe("/worker-signin");
    expect(safePasswordResetReturnPath("/admin")).toBe("/admin");
    expect(safePasswordResetReturnPath("/login")).toBe("/admin");
    expect(safePasswordResetReturnPath("https://evil.com")).toBe("/admin");
  });

  it("builds forgot href with tenant", () => {
    expect(
      buildForgotPasswordHref({ returnTo: "/worker-signin", tenant: "jobs" })
    ).toBe("/forgot?return=%2Fworker-signin&tenant=jobs");
    expect(buildForgotPasswordHref({ returnTo: "/admin", tenant: "acme" })).toBe(
      "/forgot?return=%2Fadmin&tenant=acme"
    );
  });

  it("builds post-reset sign-in href", () => {
    expect(buildPostResetSignInHref("/worker-signin", "jobs")).toBe(
      "/worker-signin?tenant=jobs"
    );
    expect(buildPostResetSignInHref("/admin", "jobs")).toBe("/admin?tenant=jobs");
  });
});
