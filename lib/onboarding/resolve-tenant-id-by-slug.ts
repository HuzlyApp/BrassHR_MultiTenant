import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .or(`slug.eq.${s},subdomain.eq.${s}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}
