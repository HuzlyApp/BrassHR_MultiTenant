import type { SupabaseClient } from "@supabase/supabase-js";

export type Edition = "smb" | "staffing";

export class EditionFeatureError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

export function parseEdition(value: unknown): Edition | null {
  return value === "smb" || value === "staffing" ? value : null;
}

/** No global cache: overrides and edition changes take effect on the next request. */
export async function loadTenantFeatures(supabase: SupabaseClient, tenantId: string) {
  const { data: category, error: categoryError } = await supabase
    .from("tenant_categories")
    .select("category, edition_set_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (categoryError) throw categoryError;
  const edition = parseEdition(category?.category?.toLowerCase());
  if (!edition || !category?.edition_set_at) {
    throw new EditionFeatureError("Classify this tenant's edition first", "EDITION_UNCLASSIFIED", 409);
  }
  const { data, error } = await supabase.from("tenant_effective_features")
    .select("feature_key, enabled").eq("tenant_id", tenantId);
  if (error) throw error;
  const features: Record<string, boolean> = Object.create(null);
  for (const row of data ?? []) features[row.feature_key] = row.enabled === true;
  return { edition, features };
}

/** Use on each protected server action; UI visibility alone is not authorization. */
export async function requireTenantFeature(supabase: SupabaseClient, tenantId: string, key: string) {
  const result = await loadTenantFeatures(supabase, tenantId);
  if (result.features[key] !== true) {
    throw new EditionFeatureError("Feature is disabled for this tenant", "FEATURE_DISABLED", 403);
  }
  return result;
}
