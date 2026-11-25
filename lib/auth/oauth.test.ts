import { describe, expect, it } from "vitest";
import {
  buildGoogleOAuthRedirectTo,
  namePartsFromOAuthUser,
  readOAuthNextPathFromCookieHeader,
  sanitizeOAuthNextPath,
  userHasGoogleIdentity,
} from "./oauth";

describe("oauth helpers", () => {
  it("sanitizes open redirects", () => {
    expect(sanitizeOAuthNextPath("/signup?oauth=google")).toBe("/signup?oauth=google");
    expect(sanitizeOAuthNextPath("//evil.com")).toBe("/login");
    expect(sanitizeOAuthNextPath("https://evil.com")).toBe("/login");
    expect(sanitizeOAuthNextPath(null)).toBe("/login");
  });

  it("builds a clean google callback redirect without query strings", () => {
    expect(buildGoogleOAuthRedirectTo("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback"
    );
  });

  it("reads next path from oauth cookie", () => {
    expect(
      readOAuthNextPathFromCookieHeader("a=1; brass_oauth_next=%2Fsignup%3Foauth%3Dgoogle; b=2")
    ).toBe("/signup?oauth=google");
  });

  it("detects google identity", () => {
    expect(
      userHasGoogleIdentity({
        identities: [{ provider: "google" }],
        app_metadata: {},
      })
    ).toBe(true);
    expect(
      userHasGoogleIdentity({
        identities: [{ provider: "email" }],
        app_metadata: { providers: ["google"] },
      })
    ).toBe(true);
    expect(
      userHasGoogleIdentity({
        identities: [{ provider: "email" }],
        app_metadata: {},
      })
    ).toBe(false);
  });

  it("parses oauth display name", () => {
    expect(
      namePartsFromOAuthUser({
        email: "Ada.Lovelace@Example.com",
        user_metadata: { given_name: "Ada", family_name: "Lovelace" },
      })
    ).toEqual({ firstName: "Ada", lastName: "Lovelace", email: "ada.lovelace@example.com" });
  });
});
