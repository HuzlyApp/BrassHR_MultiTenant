import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Explicit default for anonymous onboarding when the request has no tenant context.
 * Set `DEFAULT_TENANT_ID` (server) or `NEXT_PUBLIC_DEFAULT_TENANT_ID` (also works in client bundles).
 */
export function getConfiguredDefaultTenantId(): string | null {
  if (typeof process === "undefined") return null
  const raw =
    process.env.DEFAULT_TENANT_ID?.trim() || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID?.trim() || ""
  return UUID_RE.test(raw) ? raw.toLowerCase() : null
}

export type ResolveTenantResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string }

/**
 * Resolves the tenant UUID for platform onboarding: env first, else first active `tenants` row.
 */
export async function resolveDefaultTenantId(supabase: SupabaseClient): Promise<ResolveTenantResult> {
  const fromEnv = getConfiguredDefaultTenantId()
  if (fromEnv) return { ok: true, tenantId: fromEnv }

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, error: `Could not resolve tenant: ${error.message}` }
  if (!data?.id) {
    return {
      ok: false,
      error:
        "No active tenant found. Add a row in public.tenants or set DEFAULT_TENANT_ID (or NEXT_PUBLIC_DEFAULT_TENANT_ID) in .env.local.",
    }
  }
  return { ok: true, tenantId: String(data.id) }
}
