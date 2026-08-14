import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFirmaWorkspaces } from "@/lib/firma/client";
import { ensurePlatformTenantWithFirmaWorkspace } from "@/lib/firma/platform-tenant";
import {
  provisionFirmaWorkspaceForTenant,
  type FirmaWorkspaceProvisioningResult,
} from "@/lib/firma/provision-tenant-workspace";

export type FirmaWorkspaceBackfillRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  status: FirmaWorkspaceProvisioningResult["status"];
  workspaceId: string | null;
  message?: string;
};

export type FirmaWorkspaceBackfillResult = {
  platformTenantId: string;
  platformCreated: boolean;
  results: FirmaWorkspaceBackfillRow[];
};

/**
 * Idempotent repair: every tenant (including Braas HR / platform) gets exactly one
 * live Firma workspace. Stale stored IDs that are missing from Firma are recreated.
 */
export async function backfillFirmaWorkspacesForAllTenants(
  supabase: SupabaseClient
): Promise<FirmaWorkspaceBackfillResult> {
  const listed = await listFirmaWorkspaces();
  const knownIds = new Set(
    listed.map((row) => row.id?.trim()).filter((id): id is string => Boolean(id))
  );

  const platform = await ensurePlatformTenantWithFirmaWorkspace(supabase, {
    knownExistingWorkspaceIds: knownIds,
  });
  if (platform.firmaProvisioning.workspaceId) {
    knownIds.add(platform.firmaProvisioning.workspaceId);
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, subdomain")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const results: FirmaWorkspaceBackfillRow[] = [];

  for (const row of data ?? []) {
    const tenantId = String(row.id);
    const tenantName = String(row.name ?? "");
    const tenantSlug = (row.subdomain as string | null) ?? (row.slug as string | null);

    const provisioning = await provisionFirmaWorkspaceForTenant({
      supabase,
      tenantId,
      tenantName,
      tenantSlug,
      knownExistingWorkspaceIds: knownIds,
    });

    if (provisioning.workspaceId) {
      knownIds.add(provisioning.workspaceId);
    }

    results.push({
      tenantId,
      tenantName,
      tenantSlug,
      status: provisioning.status,
      workspaceId: provisioning.workspaceId,
      message: provisioning.message,
    });
  }

  return {
    platformTenantId: platform.tenantId,
    platformCreated: platform.created,
    results,
  };
}
