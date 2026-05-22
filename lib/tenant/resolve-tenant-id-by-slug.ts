import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve active tenant UUID from slug or subdomain label. */
export async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slugOrSubdomain: string
): Promise<string | null> {
  const key = slugOrSubdomain.trim().toLowerCase();
  if (key.length < 2) return null;

  const { data: bySlug, error: slugErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", key)
    .eq("is_active", true)
    .maybeSingle();

  if (slugErr) throw slugErr;
  if (bySlug?.id) return String(bySlug.id);

  const { data: bySub, error: subErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", key)
    .eq("is_active", true)
    .maybeSingle();

  if (subErr) throw subErr;
  return bySub?.id ? String(bySub.id) : null;
}
