import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_EXPIRY_HOURS = 72;
const TOKEN_BYTES = 32;

export type OwnerContinuationReason = "signup_continuation" | "resend";

export type OwnerOnboardingContinuationLinkResult = {
  id: string;
  url: string;
  expiresAt: string;
};

export function hashOwnerContinuationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function expiryHours(): number {
  const raw = Number(process.env.OWNER_ONBOARDING_CONTINUATION_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 14) : DEFAULT_EXPIRY_HOURS;
}

export async function createOwnerOnboardingContinuationLink(
  supabase: SupabaseClient,
  params: {
    userId: string;
    email: string;
    origin: string;
    reason?: OwnerContinuationReason;
    markSent?: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<OwnerOnboardingContinuationLinkResult | null> {
  const userId = params.userId.trim();
  const email = params.email.trim().toLowerCase();
  if (!userId || !email) return null;

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashOwnerContinuationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours() * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("owner_onboarding_continuation_links")
    .insert({
      user_id: userId,
      email,
      token_hash: tokenHash,
      target_path: "/tenant-onboarding",
      reason: params.reason ?? "signup_continuation",
      sent_at: params.markSent ? now.toISOString() : null,
      expires_at: expiresAt,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  const url = new URL("/tenant-onboarding/continue", normalizeOrigin(params.origin));
  url.searchParams.set("token", token);

  return {
    id: String((inserted as { id: string }).id),
    url: url.toString(),
    expiresAt,
  };
}

export async function hasOwnerSignupContinuationBeenSent(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("owner_onboarding_continuation_links")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", "signup_continuation")
    .not("sent_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export async function revokeActiveOwnerContinuationLinks(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("owner_onboarding_continuation_links")
    .update({ revoked_at: now })
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("expires_at", now);
}

export type OwnerContinuationLinkRow = {
  id: string;
  user_id: string;
  email: string;
  target_path: string;
  expires_at: string;
  revoked_at: string | null;
};

export async function findOwnerContinuationLinkByToken(
  supabase: SupabaseClient,
  token: string
): Promise<OwnerContinuationLinkRow | null> {
  const tokenHash = hashOwnerContinuationToken(token);
  const { data, error } = await supabase
    .from("owner_onboarding_continuation_links")
    .select("id, user_id, email, target_path, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  return (data as OwnerContinuationLinkRow | null) ?? null;
}
