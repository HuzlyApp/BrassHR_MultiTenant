import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTenantIdBySlug } from "@/lib/onboarding/resolve-tenant-id-by-slug";
import {
  resolveDefaultTenantId,
  type ResolveTenantResult,
} from "@/lib/tenant/resolve-default-tenant-id";

export { getClientOnboardingTenantIdFallback } from "@/lib/tenant/client-onboarding-tenant-fallback";

/**
 * Resolves tenant for applicant onboarding: slug/subdomain first, then platform default.
 */
export async function resolveOnboardingTenantId(
  supabase: SupabaseClient,
  slug?: string | null
): Promise<ResolveTenantResult> {
  const s = slug?.trim().toLowerCase() ?? "";
  if (s.length >= 2) {
    const id = await resolveTenantIdBySlug(supabase, s);
    if (id) return { ok: true, tenantId: id.toLowerCase() };
    return {
      ok: false,
      error: `No active tenant found for "${s}". Check the subdomain or ?tenant= slug.`,
    };
  }
  return resolveDefaultTenantId(supabase);
}
