import type { SupabaseClient } from "@supabase/supabase-js";
import {
  subdomainErrorMessage,
  validateTenantSubdomainInput,
} from "@/lib/tenant/subdomain-validation";

const SUBDOMAIN_TAKEN_MESSAGE = "This domain is already taken. Please choose another.";

/**
 * Checks whether a subdomain can be used during tenant onboarding.
 * Mirrors the availability rules in `/api/tenant-onboarding/complete`.
 */
export async function checkSubdomainAvailabilityForOnboarding(
  svc: SupabaseClient,
  rawSubdomain: string
): Promise<{ ok: true; subdomain: string } | { error: string }> {
  const parsed = validateTenantSubdomainInput(rawSubdomain);
  if ("failure" in parsed) {
    return { error: subdomainErrorMessage(parsed.failure) };
  }

  const subdomainFinal = parsed.subdomain;
  const slugFinal = subdomainFinal;

  const { data: bySubdomain, error: bsErr } = await svc
    .from("tenants")
    .select("id, subdomain, slug")
    .eq("subdomain", subdomainFinal)
    .maybeSingle();

  const { data: bySlug, error: bslugErr } = await svc
    .from("tenants")
    .select("id, subdomain, slug")
    .eq("slug", slugFinal)
    .maybeSingle();

  if (bsErr || bslugErr) {
    return { error: (bsErr || bslugErr)?.message ?? "Could not verify domain." };
  }

  if (bySlug && bySubdomain && bySlug.id !== bySubdomain.id) {
    return { error: SUBDOMAIN_TAKEN_MESSAGE };
  }

  if (bySlug?.subdomain && bySlug.subdomain !== subdomainFinal) {
    return { error: SUBDOMAIN_TAKEN_MESSAGE };
  }

  const tenantId = bySubdomain?.id ?? bySlug?.id ?? null;
  if (tenantId) {
    const { data: existingAdminRoles, error: rolesErr } = await svc
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("role", "admin")
      .limit(1);

    if (rolesErr) {
      return { error: rolesErr.message };
    }

    if ((existingAdminRoles?.length ?? 0) > 0) {
      return { error: SUBDOMAIN_TAKEN_MESSAGE };
    }
  }

  return { ok: true, subdomain: subdomainFinal };
}
