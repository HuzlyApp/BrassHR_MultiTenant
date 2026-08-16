import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isFirmaConfigured,
  updateFirmaWorkspaceSettings,
  uploadFirmaWorkspaceLogo,
} from "@/lib/firma/client";
import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
import {
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import {
  brandingFromTenantRow,
  isRemoteOrBlobImageSrc,
  type TenantBrandingRow,
} from "@/lib/tenant/tenant-branding";

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
  logoSynced: boolean;
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

const FIRMA_LOGO_MIMES = new Set(["image/png", "image/jpeg", "image/jpg"]);

function logoFilenameFromUrl(url: string, contentType: string): string {
  const fromPath = url.split("?")[0]?.split("/").pop()?.trim();
  if (fromPath && /\.(png|jpe?g)$/i.test(fromPath)) return fromPath;
  const ext = contentType.includes("png") ? "png" : "jpg";
  return `workspace-logo.${ext}`;
}

/**
 * Upload tenant company logo to Firma workspace (POST /workspaces/{id}/logo).
 * Firma accepts PNG/JPEG only — SVG and relative asset paths are skipped.
 */
export async function syncTenantLogoToFirmaWorkspace(
  workspaceId: string,
  logoUrl: string | null | undefined
): Promise<boolean> {
  const url = logoUrl?.trim();
  if (!url || !isRemoteOrBlobImageSrc(url)) {
    return false;
  }

  if (/\.svg(\?|$)/i.test(url)) {
    console.info("[firma-branding] skipping SVG logo upload (Firma requires PNG/JPEG)", {
      workspaceId,
    });
    return false;
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch tenant logo (${response.status})`);
  }

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (!contentType || !FIRMA_LOGO_MIMES.has(contentType)) {
    console.info("[firma-branding] skipping logo upload — unsupported mime type", {
      workspaceId,
      contentType: contentType || "unknown",
    });
    return false;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 2 * 1024 * 1024) {
    console.info("[firma-branding] skipping logo upload — file exceeds 2MB", {
      workspaceId,
      bytes: buffer.byteLength,
    });
    return false;
  }

  await uploadFirmaWorkspaceLogo(
    workspaceId,
    buffer,
    logoFilenameFromUrl(url, contentType),
    contentType
  );
  return true;
}

/**
 * Pushes tenant Admin Settings branding to the Firma workspace before embedded editors/signing open.
 * Uses PUT /workspace/{id}/settings per Firma multi-tenant guidance (one workspace per tenant).
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
      logoSynced: false,
    };
  }

  const row = await loadTenantBrandingRow(supabase, tenantId);
  const branding = brandingFromTenantRow(row);
  const colors = tenantBrandingToFirmaWorkspaceSettings(branding);

  const workspaceApplied = await updateFirmaWorkspaceSettings(workspaceId, colors);

  let logoSynced = false;
  try {
    logoSynced = await syncTenantLogoToFirmaWorkspace(workspaceId, branding.logoUrl);
  } catch (logoErr) {
    logFirmaWorkspaceBrandingSyncFailure(
      "workspace logo sync failed",
      { tenantId, workspaceId },
      logoErr
    );
  }

  console.info("[firma-branding] Firma workspace appearance synced", {
    tenantId,
    workspaceId,
    workspace_primary: workspaceApplied.color_primary ?? colors.color_primary,
    workspace_accent: workspaceApplied.color_accent ?? colors.color_accent,
    logoSynced,
  });

  return {
    synced: true,
    workspaceId,
    colors,
    logoSynced,
  };
}
