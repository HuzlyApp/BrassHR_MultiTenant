import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTHENTICATOR_CODE_LENGTH = 6;
export const AUTHENTICATOR_FRIENDLY_NAME = "Authenticator app";
export const AUTHENTICATOR_ISSUER_FALLBACK = "BrassHR";

export type AuthenticatorFactorStatus = "verified" | "unverified";

export type AuthenticatorFactor = {
  id: string;
  friendlyName: string | null;
  status: AuthenticatorFactorStatus;
  createdAt: string | null;
};

type ListedFactor = {
  id: string;
  factor_type?: string;
  status?: string;
  friendly_name?: string | null;
  created_at?: string | null;
};

export type AuthenticatorChallengeState = "ready" | "challenge" | "unavailable";

export function authenticatorIssuer(name: string | null | undefined): string {
  const cleaned = (name ?? "").replace(/:/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return AUTHENTICATOR_ISSUER_FALLBACK;
  return cleaned.slice(0, 40);
}

/** Supabase returns the QR as SVG markup. Browsers need it as an image URL. */
export function authenticatorQrSrc(qrCode: string): string {
  const value = qrCode.trim();
  if (
    value.startsWith("data:") ||
    value.startsWith("https://") ||
    value.startsWith("http://")
  ) {
    return value;
  }
  return `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`;
}

export function formatAuthenticatorSecret(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function normalizeAuthenticatorCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, AUTHENTICATOR_CODE_LENGTH);
}

export function isAuthenticatorCode(value: string): boolean {
  return new RegExp(`^\\d{${AUTHENTICATOR_CODE_LENGTH}}$`).test(normalizeAuthenticatorCode(value));
}

/**
 * A verified authenticator means the next sign-in level is aal2.
 * The current session still needs the code until it is also aal2.
 */
export function needsAuthenticatorChallenge(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined
): boolean {
  return nextLevel === "aal2" && currentLevel !== "aal2";
}

export function totpFactorsFromList(factors: ListedFactor[] | null | undefined): AuthenticatorFactor[] {
  return (factors ?? [])
    .filter((factor) => factor.factor_type === "totp" && factor.id)
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name?.trim() || null,
      status: factor.status === "verified" ? "verified" : "unverified",
      createdAt: factor.created_at ?? null,
    }));
}

function errorMessage(error: { message?: string } | null | undefined, fallback: string): string {
  const message = error?.message?.trim();
  return message || fallback;
}

export async function listAuthenticatorFactors(
  client: SupabaseClient
): Promise<AuthenticatorFactor[]> {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new Error(errorMessage(error, "Could not load your authenticator."));
  return totpFactorsFromList(data?.all);
}

export async function enrollAuthenticator(
  client: SupabaseClient,
  issuer: string
): Promise<{ factorId: string; qrSrc: string; secret: string }> {
  const existing = await listAuthenticatorFactors(client);
  if (existing.some((factor) => factor.status === "verified")) {
    throw new Error("An authenticator app is already on for this account.");
  }

  for (const factor of existing) {
    if (factor.status !== "unverified") continue;
    const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) {
      throw new Error(errorMessage(removed.error, "Could not start authenticator setup."));
    }
  }

  const enrolled = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: AUTHENTICATOR_FRIENDLY_NAME,
    issuer,
  });
  if (enrolled.error || !enrolled.data || enrolled.data.type !== "totp") {
    throw new Error(errorMessage(enrolled.error, "Could not start authenticator setup."));
  }

  return {
    factorId: enrolled.data.id,
    qrSrc: authenticatorQrSrc(enrolled.data.totp.qr_code),
    secret: enrolled.data.totp.secret,
  };
}

export async function cancelAuthenticatorEnrollment(
  client: SupabaseClient,
  factorId: string
): Promise<void> {
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(errorMessage(error, "Could not cancel authenticator setup."));
}

export async function verifyAuthenticatorCode(
  client: SupabaseClient,
  factorId: string,
  code: string
): Promise<void> {
  const normalized = normalizeAuthenticatorCode(code);
  if (!isAuthenticatorCode(normalized)) {
    throw new Error("Enter the 6-digit code from your authenticator app.");
  }
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId,
    code: normalized,
  });
  if (verified.error) {
    throw new Error(errorMessage(verified.error, "That code did not match. Try the code currently on screen."));
  }
}

export async function verifyCurrentAuthenticator(
  client: SupabaseClient,
  code: string
): Promise<void> {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new Error(errorMessage(error, "Could not load your authenticator."));
  const factor = data?.totp?.[0];
  if (!factor) throw new Error("No authenticator app is set up on this account.");
  await verifyAuthenticatorCode(client, factor.id, code);
}

export async function removeAuthenticator(client: SupabaseClient, factorId: string): Promise<void> {
  const { error } = await client.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(errorMessage(error, "Could not turn off the authenticator."));
}

export async function readAuthenticatorChallengeState(
  client: SupabaseClient
): Promise<AuthenticatorChallengeState> {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!error && data) {
    return needsAuthenticatorChallenge(data.currentLevel, data.nextLevel) ? "challenge" : "ready";
  }

  const listed = await client.auth.mfa.listFactors();
  if (listed.error || !listed.data) return "unavailable";
  if (!listed.data.totp?.[0]) return "ready";
  if (data?.currentLevel === "aal2") return "ready";
  return "challenge";
}
