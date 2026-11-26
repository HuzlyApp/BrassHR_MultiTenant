import type { SupabaseClient } from "@supabase/supabase-js";

/** Client-compatible resolver: do not import the server-only Redis cache here. */
export async function resolveTenantIdBySlug(supabase: SupabaseClient, slug: string): Promise<string | null> {
  const value = slug.trim().toLowerCase();
  if (!value) return null;
  const { data, error } = await supabase.rpc("public_tenant_branding", { p_kind: "slug", p_value: value });
  if (error) throw error;
  return typeof data?.id === "string" ? data.id : null;
}
