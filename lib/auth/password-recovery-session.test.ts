import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";
import {
  authSessionIsPasswordRecovery,
  planPasswordRecoverySession,
  readPasswordRecoveryLinkParams,
} from "@/lib/auth/password-recovery-session";

function jwtWithAmr(methods: Array<string | { method: string }>): string {
  const payload = Buffer.from(JSON.stringify({ amr: methods })).toString("base64url");
  return `header.${payload}.sig`;
}

describe("readPasswordRecoveryLinkParams", () => {
  it("reads token_hash recovery links", () => {
    const params = readPasswordRecoveryLinkParams(
      new URLSearchParams("token_hash=abc&type=recovery&tenant=zipstaff")
    );
    expect(params).toEqual({ tokenHash: "abc", type: "recovery", code: null });
  });

  it("reads PKCE code links", () => {
    const params = readPasswordRecoveryLinkParams(new URLSearchParams("code=pkce-code"));
    expect(params.code).toBe("pkce-code");
  });
});

describe("planPasswordRecoverySession", () => {
  const recoveryLink = { tokenHash: "abc", type: "recovery", code: null as string | null };
  const noLink = { tokenHash: null, type: null, code: null };

  it("always verifies a recovery link even if someone is already signed in", () => {
    expect(
      planPasswordRecoverySession({
        hasExistingSession: true,
        sessionIsRecovery: false,
        link: recoveryLink,
      })
    ).toBe("verify-link");
  });

  it("reuses only an existing recovery session when the URL no longer has a token", () => {
    expect(
      planPasswordRecoverySession({
        hasExistingSession: true,
        sessionIsRecovery: true,
        link: noLink,
      })
    ).toBe("reuse-recovery-session");
  });

  it("rejects a logged-in admin/password session without a recovery token", () => {
    expect(
      planPasswordRecoverySession({
        hasExistingSession: true,
        sessionIsRecovery: false,
        link: noLink,
      })
    ).toBe("reject");
  });
});

describe("authSessionIsPasswordRecovery", () => {
  it("detects recovery AMR on the access token", () => {
    const session = {
      access_token: jwtWithAmr([{ method: "recovery" }]),
      user: { id: "user-1" },
    } as unknown as Session;
    expect(authSessionIsPasswordRecovery(session)).toBe(true);
  });

  it("does not treat a password login as recovery", () => {
    const session = {
      access_token: jwtWithAmr([{ method: "password" }]),
      user: { id: "admin-1" },
    } as unknown as Session;
    expect(authSessionIsPasswordRecovery(session)).toBe(false);
  });
});
