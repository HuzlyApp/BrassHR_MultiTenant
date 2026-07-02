import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isFirmaConfigured, updateFirmaWorkspaceSettings } from "@/lib/firma/client";
import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
import { tenantBrandingToFirmaWorkspaceSettings } from "@/lib/firma/sync-workspace-branding-colors";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import {
  brandingFromTenantRow,
  type TenantBrandingRow,
} from "@/lib/tenant/tenant-branding";

export { contrastForegroundOnHex, tenantBrandingToFirmaWorkspaceSettings } from "@/lib/firma/sync-workspace-branding-colors";

export async function loadTenantBrandingRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantBrandingRow | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("id", tenantId)
    .maybeSingle<TenantBrandingRow>();

  if (error) throw error;
  return data ?? null;
}

export type FirmaWorkspaceBrandingSyncResult = {
  synced: boolean;
  workspaceId: string;
  colors: FirmaWorkspaceAppearanceSettings;
};

/** Log Firma branding sync issues in all environments (prod failures were previously silent). */
export function logFirmaWorkspaceBrandingSyncFailure(
  context: string,
  detail: Record<string, unknown>,
  err: unknown
): void {
  console.error(`[firma-branding] ${context}`, {
    ...detail,
    error: err instanceof Error ? err.message : err,
  });
}

/**
 * Pushes tenant branding colors to the Firma workspace before opening embedded editors.
 * Firma applies these to template builder + signing UI chrome (not via embed init options).
 */
export async function syncTenantBrandingToFirmaWorkspace(
  supabase: SupabaseClient,
  tenantId: string,
  workspaceId: string
): Promise<FirmaWorkspaceBrandingSyncResult> {
  if (!isFirmaConfigured()) {
    return {
      synced: false,
      workspaceId,
      colors: {},
    };
  }

  const row = await loadTenantBrandingRow(supabase, tenantId);
  const branding = brandingFromTenantRow(row, row?.slug ?? undefined);
  const colors = tenantBrandingToFirmaWorkspaceSettings(branding);

  await updateFirmaWorkspaceSettings(workspaceId, colors);

  return {
    synced: true,
    workspaceId,
    colors,
  };
}
