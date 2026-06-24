import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFirmaWorkspaceId } from "@/lib/firma/client";

export class FirmaWorkspaceConfigError extends Error {
  readonly status = 503;

  constructor(message: string) {
    super(message);
    this.name = "FirmaWorkspaceConfigError";
  }
}

export function resolveFirmaWorkspaceIdFromEnv(): string | undefined {
  return getFirmaWorkspaceId();
}

export async function loadTenantFirmaWorkspaceId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("firma_workspace_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;

  const value = data?.firma_workspace_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolves the effective Firma workspace for a tenant.
 * Uses tenant.firma_workspace_id when set, otherwise FIRMA_WORKSPACE_ID env fallback.
 */
export async function resolveTenantFirmaWorkspaceId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const tenantWorkspace = await loadTenantFirmaWorkspaceId(supabase, tenantId);
  const effective = tenantWorkspace ?? resolveFirmaWorkspaceIdFromEnv();
  if (!effective) {
    throw new FirmaWorkspaceConfigError(
      "Firma workspace is not configured for this organization. Set a Firma workspace ID in Account Settings (Integrations), or configure FIRMA_WORKSPACE_ID on the server."
    );
  }
  return effective;
}

/** Returns true when a stored workspace id conflicts with the tenant's current workspace. */
export function isStoredFirmaWorkspaceMismatch(
  storedWorkspaceId: string | null | undefined,
  effectiveWorkspaceId: string
): boolean {
  const stored = storedWorkspaceId?.trim();
  if (!stored) return false;
  return stored !== effectiveWorkspaceId.trim();
}
