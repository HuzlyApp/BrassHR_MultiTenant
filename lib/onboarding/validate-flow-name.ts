import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export function normalizeFlowNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isValidFlowNameInput(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Workflow name is required.";
  if (trimmed.length < 2) return "Workflow name must be at least 2 characters.";
  if (trimmed.length > 120) return "Workflow name must be 120 characters or less.";
  return null;
}

/**
 * Returns an error message when another saved workflow template in the tenant
 * already uses this display name (case-insensitive).
 */
export type DuplicateFlowNameScope = "tenant-default" | "full";

export async function findDuplicateFlowName(
  supabase: OnboardingDbClient,
  tenantId: string,
  flowName: string,
  opts?: {
    excludeTemplateId?: string;
    excludeFlowName?: string;
    /** Tenant default onboarding uses its own namespace (tenant_onboarding_configs.flow_name). */
    scope?: DuplicateFlowNameScope;
  }
): Promise<string | null> {
  const validation = isValidFlowNameInput(flowName);
  if (validation) return validation;

  const normalized = normalizeFlowNameKey(flowName);
  const excludeCurrent = normalizeFlowNameKey(opts?.excludeFlowName ?? "");

  if (excludeCurrent && normalized === excludeCurrent) {
    return null;
  }

  const scope = opts?.scope ?? "full";

  if (scope === "tenant-default") {
    // Named flows in onboarding_flows are a separate list; they may share a display
    // name with the tenant's default applicant onboarding flow.
    return null;
  }

  const { data: templates, error: templateError } = await supabase
    .from("onboarding_templates")
    .select("id, flow_name, name")
    .eq("tenant_id", tenantId);

  if (templateError) throw templateError;

  for (const row of templates ?? []) {
    if (opts?.excludeTemplateId && String(row.id) === opts.excludeTemplateId) continue;
    const existing = normalizeFlowNameKey(
      String(row.flow_name ?? row.name ?? "").replace(/\.tpl$/i, "")
    );
    if (existing && existing === normalized) {
      return `A workflow named "${flowName.trim()}" already exists. Please choose another name.`;
    }
  }

  const { data: flows, error: flowError } = await supabase
    .from("onboarding_flows")
    .select("id, name")
    .eq("tenant_id", tenantId);

  if (flowError) throw flowError;

  for (const row of flows ?? []) {
    const existing = normalizeFlowNameKey(String(row.name));
    if (existing && existing === normalized) {
      return `A workflow named "${flowName.trim()}" already exists. Please choose another name.`;
    }
  }

  return null;
}
