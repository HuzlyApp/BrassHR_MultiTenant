import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFirmaWorkspace, isFirmaConfigured } from "@/lib/firma/client";
import { FirmaError } from "@/lib/firma/errors";
import { syncTenantBrandingToFirmaWorkspace } from "@/lib/firma/sync-workspace-branding";

export type FirmaWorkspaceProvisioningMode = "manual" | "api" | "disabled";

export type FirmaWorkspaceProvisioningStatus = "created" | "already_configured" | "failed";

export type FirmaWorkspaceProvisioningResult = {
  status: FirmaWorkspaceProvisioningStatus;
  workspaceId: string | null;
  message?: string;
};

const API_KEY_PATTERN = /firma_(live|test)_[A-Za-z0-9_-]+/gi;
const FAILED_MESSAGE =
  "Tenant was created, but Firma workspace creation failed. You can retry in Account Settings.";

function sanitizeProvisioningError(message: string): string {
  return message.replace(API_KEY_PATTERN, "firma_[REDACTED]").trim();
}

/** Default is `api` (automatic workspace creation on tenant signup). Set `manual` or `disabled` to opt out. */
export function getFirmaWorkspaceProvisioningMode(): FirmaWorkspaceProvisioningMode {
  const raw = (process.env.FIRMA_WORKSPACE_PROVISIONING_MODE ?? "api").trim().toLowerCase();
  if (raw === "manual" || raw === "disabled") return raw;
  return "api";
}

export function buildFirmaWorkspaceNameForTenant(
  tenantName: string,
  tenantSlug?: string | null
): string {
  const name = tenantName.trim();
  const slug = tenantSlug?.trim();
  return `BrassHR - ${name}${slug ? ` (${slug})` : ""}`;
}

type TenantProvisioningRow = {
  firma_workspace_id: string | null;
  name: string;
  subdomain: string | null;
  slug: string | null;
};

async function loadTenantProvisioningRow(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantProvisioningRow | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("firma_workspace_id, name, subdomain, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as TenantProvisioningRow;
}

async function persistProvisioningStatus(
  supabase: SupabaseClient,
  tenantId: string,
  patch: {
    firma_workspace_id?: string | null;
    firma_workspace_provisioning_status: string;
    firma_workspace_provisioning_error?: string | null;
    firma_workspace_provisioned_at?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("tenants")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) throw error;
}

export async function provisionFirmaWorkspaceForTenant(input: {
  supabase: SupabaseClient;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string | null;
}): Promise<FirmaWorkspaceProvisioningResult> {
  const tenant = await loadTenantProvisioningRow(input.supabase, input.tenantId);
  if (!tenant) {
    return {
      status: "failed",
      workspaceId: null,
      message: "Tenant not found for Firma workspace provisioning",
    };
  }

  const existingWorkspace = tenant.firma_workspace_id?.trim();
  if (existingWorkspace) {
    return {
      status: "already_configured",
      workspaceId: existingWorkspace,
    };
  }

  const mode = getFirmaWorkspaceProvisioningMode();
  if (mode === "disabled") {
    await persistProvisioningStatus(input.supabase, input.tenantId, {
      firma_workspace_provisioning_status: "failed",
      firma_workspace_provisioning_error: "Firma workspace provisioning is disabled on this server",
    });
    return {
      status: "failed",
      workspaceId: null,
      message: FAILED_MESSAGE,
    };
  }

  if (mode === "manual") {
    await persistProvisioningStatus(input.supabase, input.tenantId, {
      firma_workspace_provisioning_status: "failed",
      firma_workspace_provisioning_error: "Automatic Firma workspace provisioning is disabled (manual mode)",
    });
    return {
      status: "failed",
      workspaceId: null,
      message: FAILED_MESSAGE,
    };
  }

  if (!isFirmaConfigured()) {
    const error = "Firma API is not configured (missing FIRMA_API_KEY)";
    await persistProvisioningStatus(input.supabase, input.tenantId, {
      firma_workspace_provisioning_status: "failed",
      firma_workspace_provisioning_error: error,
    });
    return {
      status: "failed",
      workspaceId: null,
      message: FAILED_MESSAGE,
    };
  }

  const workspaceName = buildFirmaWorkspaceNameForTenant(
    input.tenantName || tenant.name,
    input.tenantSlug ?? tenant.subdomain ?? tenant.slug
  );

  try {
    const created = await createFirmaWorkspace({ name: workspaceName });
    const provisionedAt = new Date().toISOString();

    await persistProvisioningStatus(input.supabase, input.tenantId, {
      firma_workspace_id: created.id,
      firma_workspace_provisioning_status: "created",
      firma_workspace_provisioning_error: null,
      firma_workspace_provisioned_at: provisionedAt,
    });

    try {
      await syncTenantBrandingToFirmaWorkspace(input.supabase, input.tenantId, created.id);
    } catch (brandingErr) {
      console.error("[firma-provision] workspace branding sync failed", {
        tenantId: input.tenantId,
        workspaceId: created.id,
        error: brandingErr instanceof Error ? brandingErr.message : brandingErr,
      });
    }

    return {
      status: "created",
      workspaceId: created.id,
    };
  } catch (err) {
    const message = sanitizeProvisioningError(
      err instanceof FirmaError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Firma workspace provisioning failed"
    );

    console.error("[firma-provision] tenant", input.tenantId, message);

    await persistProvisioningStatus(input.supabase, input.tenantId, {
      firma_workspace_provisioning_status: "failed",
      firma_workspace_provisioning_error: message,
    });

    return {
      status: "failed",
      workspaceId: null,
      message: FAILED_MESSAGE,
    };
  }
}
