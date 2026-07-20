import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isFirmaConfigured,
  updateFirmaCompanyAppearanceSettings,
  updateFirmaWorkspaceSettings,
} from "@/lib/firma/client";
import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
import { buildBrassHrFirmaAppearanceSettings } from "@/lib/firma/sync-workspace-branding-colors";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";

export {
  buildBrassHrFirmaAppearanceSettings,
  contrastForegroundOnHex,
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";

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
 * Pushes BrassHR gold appearance to Firma company + workspace settings before embedded editors open.
 * Matches app.firma.dev → Settings → Appearance so the template builder inherits gold primary.
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

  const colors = buildBrassHrFirmaAppearanceSettings();

  const [companyApplied, workspaceApplied] = await Promise.all([
    updateFirmaCompanyAppearanceSettings(colors),
    updateFirmaWorkspaceSettings(workspaceId, colors),
  ]);

  console.info("[firma-branding] Firma appearance synced", {
    tenantId,
    workspaceId,
    company_primary: companyApplied.color_primary ?? colors.color_primary,
    company_accent: companyApplied.color_accent ?? colors.color_accent,
    workspace_primary: workspaceApplied.color_primary ?? colors.color_primary,
    workspace_accent: workspaceApplied.color_accent ?? colors.color_accent,
  });

  return {
    synced: true,
    workspaceId,
    colors,
  };
}
