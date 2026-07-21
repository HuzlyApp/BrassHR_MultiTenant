import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantBrandingToFirmaEmbedColorPalette } from "@/lib/firma/embed-color-palette";
import type { FirmaEmbedColorPalette } from "@/lib/firma/embed-color-palette";
import { loadTenantBrandingRow } from "@/lib/firma/sync-workspace-branding";
import { brandingFromTenantRow } from "@/lib/tenant/tenant-branding";

/**
 * Resolve tenant embed palette for proxied Firma signing pages (/signing/{recipientId}).
 * Looks up the applicant signing session by Firma recipient or signing-request id.
 */
export async function resolveSigningEmbedPaletteForRecipient(
  supabase: SupabaseClient,
  recipientOrRequestId: string
): Promise<FirmaEmbedColorPalette | null> {
  const key = recipientOrRequestId.trim();
  if (!key) return null;

  const { data: session, error } = await supabase
    .from("worker_firma_signing_sessions")
    .select("tenant_id")
    .or(`signing_request_user_id.eq.${key},signing_request_id.eq.${key}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();

  if (error) {
    console.warn("[firma-signing-proxy] session lookup failed", { key, error: error.message });
    return null;
  }

  if (!session?.tenant_id) return null;

  const row = await loadTenantBrandingRow(supabase, session.tenant_id);
  if (!row) return null;

  return tenantBrandingToFirmaEmbedColorPalette(brandingFromTenantRow(row));
}
