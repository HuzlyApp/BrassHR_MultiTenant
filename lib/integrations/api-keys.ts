import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const INBOUND_API_KEY_PREFIX = "bhr_in_";

export type TenantApiKeyRecord = {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdByUserId: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedTenantApiKey = TenantApiKeyRecord & {
  /** Plaintext key — returned once at creation only. */
  apiKey: string;
};

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

function mapRow(row: Record<string, unknown>): TenantApiKeyRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name ?? ""),
    keyPrefix: String(row.key_prefix ?? ""),
    scopes: Array.isArray(row.scopes)
      ? row.scopes.map((scope) => String(scope))
      : ["inbound"],
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export function generateInboundApiKey(): { apiKey: string; keyPrefix: string; keyHash: string } {
  const secret = randomBytes(24).toString("base64url");
  const apiKey = `${INBOUND_API_KEY_PREFIX}${secret}`;
  const keyPrefix = apiKey.slice(0, 12);
  return { apiKey, keyPrefix, keyHash: hashApiKey(apiKey) };
}

export async function listTenantApiKeys(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantApiKeyRecord[]> {
  const { data, error } = await supabase
    .from("tenant_api_keys")
    .select(
      "id, tenant_id, name, key_prefix, scopes, created_by_user_id, last_used_at, revoked_at, created_at"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createTenantApiKey(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    name: string;
    createdByUserId: string | null;
    scopes?: string[];
  }
): Promise<CreatedTenantApiKey> {
  const name = input.name.trim();
  if (!name) throw new Error("API key name is required.");
  if (name.length > 120) throw new Error("API key name must be 120 characters or fewer.");

  const generated = generateInboundApiKey();
  const scopes = input.scopes?.length ? input.scopes : ["inbound"];

  const { data, error } = await supabase
    .from("tenant_api_keys")
    .insert({
      tenant_id: input.tenantId,
      name,
      key_prefix: generated.keyPrefix,
      key_hash: generated.keyHash,
      scopes,
      created_by_user_id: input.createdByUserId,
    })
    .select(
      "id, tenant_id, name, key_prefix, scopes, created_by_user_id, last_used_at, revoked_at, created_at"
    )
    .single();
  if (error) throw error;

  return {
    ...mapRow(data as Record<string, unknown>),
    apiKey: generated.apiKey,
  };
}

export async function revokeTenantApiKey(
  supabase: SupabaseClient,
  input: { tenantId: string; keyId: string }
): Promise<TenantApiKeyRecord | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tenant_api_keys")
    .update({ revoked_at: now, updated_at: now })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.keyId)
    .is("revoked_at", null)
    .select(
      "id, tenant_id, name, key_prefix, scopes, created_by_user_id, last_used_at, revoked_at, created_at"
    )
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export type VerifiedTenantApiKey = TenantApiKeyRecord & {
  keyHash: string;
};

export async function verifyInboundApiKey(
  supabase: SupabaseClient,
  apiKey: string
): Promise<VerifiedTenantApiKey | null> {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith(INBOUND_API_KEY_PREFIX) || trimmed.length < 20) return null;

  const keyHash = hashApiKey(trimmed);
  const { data, error } = await supabase
    .from("tenant_api_keys")
    .select(
      "id, tenant_id, name, key_prefix, scopes, created_by_user_id, last_used_at, revoked_at, created_at, key_hash"
    )
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const mapped = mapRow(data as Record<string, unknown>);
  return { ...mapped, keyHash };
}

export async function touchApiKeyLastUsed(
  supabase: SupabaseClient,
  keyId: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("tenant_api_keys")
    .update({ last_used_at: now, updated_at: now })
    .eq("id", keyId);
  if (error) {
    console.warn("[tenant_api_keys] last_used_at update failed:", error.message);
  }
}
