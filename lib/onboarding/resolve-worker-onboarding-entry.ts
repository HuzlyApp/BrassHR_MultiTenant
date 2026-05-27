import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { firstOnboardingStepRoute, getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { loadOnboardingBuilderMeta } from "@/lib/onboarding/load-onboarding-builder-meta";
import { withTenant } from "@/lib/tenant/with-tenant";

export type WorkerOnboardingEntryErrorCode =
  | "TENANT_REQUIRED"
  | "TENANT_NOT_FOUND"
  | "NOT_PUBLISHED";

export type WorkerOnboardingEntryResult =
  | { kind: "redirect"; url: string; tenantSlug: string }
  | {
      kind: "error";
      code: WorkerOnboardingEntryErrorCode;
      message: string;
      tenantSlug?: string | null;
    };

function serviceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Resolves and validates a tenant slug, then returns the first applicant step URL
 * or a structured error (unknown tenant, unpublished flow, etc.).
 */
export async function resolveWorkerOnboardingEntry(
  tenantSlugInput: string | null | undefined
): Promise<WorkerOnboardingEntryResult> {
  const slug = tenantSlugInput?.trim().toLowerCase() ?? "";
  if (!slug || slug.length < 2) {
    return {
      kind: "error",
      code: "TENANT_REQUIRED",
      message: "No organization was specified. Open the link you received from your employer or add ?tenant= to the URL.",
      tenantSlug: null,
    };
  }

  const supabase = serviceClient();
  if (!supabase) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "Onboarding is temporarily unavailable. Please try again later.",
      tenantSlug: slug,
    };
  }

  const { data: tenantRow, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, slug, subdomain, is_active, name")
    .or(`slug.eq.${slug},subdomain.eq.${slug}`)
    .maybeSingle();

  if (tenantErr) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "We could not verify this organization.",
      tenantSlug: slug,
    };
  }

  if (!tenantRow?.id || tenantRow.is_active === false) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "This organization was not found or is no longer active.",
      tenantSlug: slug,
    };
  }

  const tenantId = String(tenantRow.id);
  const canonicalSlug = String(tenantRow.slug ?? tenantRow.subdomain ?? slug).toLowerCase();
  if (slug !== canonicalSlug && slug !== String(tenantRow.subdomain ?? "").toLowerCase()) {
    return {
      kind: "error",
      code: "TENANT_NOT_FOUND",
      message: "This organization was not found.",
      tenantSlug: slug,
    };
  }

  const builder = await loadOnboardingBuilderMeta(supabase, tenantId);
  if (builder.publishStatus !== "published") {
    return {
      kind: "error",
      code: "NOT_PUBLISHED",
      message: "This tenant has not published an onboarding flow yet.",
      tenantSlug: canonicalSlug,
    };
  }

  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  const enabledSteps = getEnabledTenantSteps(config);
  if (!enabledSteps.length) {
    return {
      kind: "error",
      code: "NOT_PUBLISHED",
      message: "This tenant has not published an onboarding flow yet.",
      tenantSlug: canonicalSlug,
    };
  }

  const firstPath = firstOnboardingStepRoute(config, canonicalSlug);
  return {
    kind: "redirect",
    url: firstPath.startsWith("/") ? firstPath : withTenant(firstPath, canonicalSlug),
    tenantSlug: canonicalSlug,
  };
}
