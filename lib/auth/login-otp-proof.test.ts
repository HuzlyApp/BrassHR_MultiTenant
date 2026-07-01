import { beforeEach, describe, expect, it } from "vitest";
import {
  createLoginOtpProof,
  verifyLoginOtpProof,
} from "@/lib/auth/login-otp-proof";

describe("login OTP proof", () => {
  const email = "user@example.com";
  const now = Date.parse("2026-07-02T12:00:00.000Z");

  beforeEach(() => {
    process.env.LOGIN_OTP_PROOF_SECRET = "test-proof-secret";
    process.env.LOGIN_OTP_TTL_SECONDS = "600";
  });

  it("accepts a freshly issued proof for the same email", () => {
    const proof = createLoginOtpProof(email, now);
    expect(verifyLoginOtpProof(email, proof, now + 1000)).toBe(true);
  });

  it("rejects proofs for a different email", () => {
    const proof = createLoginOtpProof(email, now);
    expect(verifyLoginOtpProof("other@example.com", proof, now + 1000)).toBe(false);
  });

  it("rejects expired proofs", () => {
    const proof = createLoginOtpProof(email, now);
    expect(verifyLoginOtpProof(email, proof, now + 601_000)).toBe(false);
  });
});
