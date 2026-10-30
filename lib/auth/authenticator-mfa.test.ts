import { describe, expect, it } from "vitest";
import {
  authenticatorIssuer,
  authenticatorQrSrc,
  formatAuthenticatorSecret,
  isAuthenticatorCode,
  needsAuthenticatorChallenge,
  normalizeAuthenticatorCode,
  totpFactorsFromList,
} from "@/lib/auth/authenticator-mfa";

describe("authenticator mfa helpers", () => {
  it("turns the Supabase SVG QR into an image source", () => {
    expect(authenticatorQrSrc("<svg xmlns='http://www.w3.org/2000/svg'></svg>")).toBe(
      "data:image/svg+xml;utf-8,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%3E%3C%2Fsvg%3E"
    );
    expect(authenticatorQrSrc("data:image/svg+xml;utf-8,already")).toBe(
      "data:image/svg+xml;utf-8,already"
    );
  });

  it("uses the organization name as the authenticator issuer", () => {
    expect(authenticatorIssuer("Zippy Corp")).toBe("Zippy Corp");
    expect(authenticatorIssuer("  ")).toBe("BrassHR");
    expect(authenticatorIssuer("A:B")).toBe("A B");
  });

  it("groups the setup key and accepts only a 6-digit code", () => {
    expect(formatAuthenticatorSecret("abcd efgh ijkl")).toBe("abcd efgh ijkl");
    expect(normalizeAuthenticatorCode("12 34-56xx")).toBe("123456");
    expect(isAuthenticatorCode("123456")).toBe(true);
    expect(isAuthenticatorCode("12345")).toBe(false);
  });

  it("asks for a code only when a verified factor is still unchecked", () => {
    expect(needsAuthenticatorChallenge("aal1", "aal2")).toBe(true);
    expect(needsAuthenticatorChallenge(null, "aal2")).toBe(true);
    expect(needsAuthenticatorChallenge("aal2", "aal2")).toBe(false);
    expect(needsAuthenticatorChallenge("aal1", "aal1")).toBe(false);
    expect(needsAuthenticatorChallenge("aal2", "aal1")).toBe(false);
  });

  it("keeps totp factors and ignores other factor types", () => {
    expect(
      totpFactorsFromList([
        {
          id: "phone-1",
          factor_type: "phone",
          status: "verified",
          friendly_name: "Phone",
          created_at: null,
        },
        {
          id: "totp-1",
          factor_type: "totp",
          status: "verified",
          friendly_name: "Authenticator app",
          created_at: "2026-10-31T00:00:00Z",
        },
      ])
    ).toEqual([
      {
        id: "totp-1",
        friendlyName: "Authenticator app",
        status: "verified",
        createdAt: "2026-10-31T00:00:00Z",
      },
    ]);
  });
});
