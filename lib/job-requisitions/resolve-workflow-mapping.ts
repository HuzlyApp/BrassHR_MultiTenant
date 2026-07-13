import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmploymentType,
  JobRequisitionAttributes,
  PlacementType,
  WorkflowMappingRow,
} from "@/lib/job-requisitions/types";

export type WorkflowMappingMatch = {
  workflowTemplateId: string;
  mappingId: string | null;
  matchLevel:
    | "exact"
    | "role_employment"
    | "role_only"
    | "tenant_default"
    | "none";
  priority: number;
};

function normalizeRole(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function mappingSpecificity(row: WorkflowMappingRow): number {
  let score = 0;
  if (row.job_role) score += 4;
  if (row.employment_type) score += 2;
  if (row.placement_type) score += 1;
  return score;
}

function mappingMatches(
  row: WorkflowMappingRow,
  attrs: JobRequisitionAttributes
): boolean {
  if (row.job_role && normalizeRole(row.job_role) !== normalizeRole(attrs.jobRole)) {
    return false;
  }
  if (row.employment_type && row.employment_type !== attrs.employmentType) {
    return false;
  }
  if (row.placement_type && row.placement_type !== attrs.placementType) {
    return false;
  }
  return true;
}

function matchLevelFromRow(row: WorkflowMappingRow): WorkflowMappingMatch["matchLevel"] {
  const hasRole = Boolean(row.job_role);
  const hasEmployment = Boolean(row.employment_type);
  const hasPlacement = Boolean(row.placement_type);
  if (hasRole && hasEmployment && hasPlacement) return "exact";
  if (hasRole && hasEmployment) return "role_employment";
  if (hasRole && !hasEmployment && !hasPlacement) return "role_only";
  if (!hasRole && !hasEmployment && !hasPlacement) return "tenant_default";
  return "role_only";
}

/** Pure resolver for unit tests — picks the most specific active mapping. */
export function resolveWorkflowMappingFromRows(
  mappings: WorkflowMappingRow[],
  attrs: JobRequisitionAttributes,
  defaultWorkflowTemplateId: string | null
): WorkflowMappingMatch {
  const active = mappings.filter((m) => m.is_active && mappingMatches(m, attrs));
  if (active.length) {
    const best = [...active].sort((a, b) => {
      const specDiff = mappingSpecificity(b) - mappingSpecificity(a);
      if (specDiff !== 0) return specDiff;
      return b.priority - a.priority;
    })[0]!;

    return {
      workflowTemplateId: best.workflow_template_id,
      mappingId: best.id,
      matchLevel: matchLevelFromRow(best),
      priority: best.priority,
    };
  }

  if (defaultWorkflowTemplateId) {
    return {
      workflowTemplateId: defaultWorkflowTemplateId,
      mappingId: null,
      matchLevel: "tenant_default",
      priority: 0,
    };
  }

  return {
    workflowTemplateId: "",
    mappingId: null,
    matchLevel: "none",
    priority: -1,
  };
}

export async function loadTenantDefaultWorkflowId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenant_workflow_settings")
    .select("default_workflow_template_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data?.default_workflow_template_id
    ? String(data.default_workflow_template_id)
    : null;
}

export async function resolveWorkflowMapping(
  supabase: SupabaseClient,
  attrs: JobRequisitionAttributes
): Promise<WorkflowMappingMatch> {
  const [{ data: mappings, error }, defaultId] = await Promise.all([
    supabase
      .from("workflow_template_mappings")
      .select(
        "id, tenant_id, job_role, employment_type, placement_type, workflow_template_id, priority, is_active"
      )
      .eq("tenant_id", attrs.tenantId)
      .eq("is_active", true),
    loadTenantDefaultWorkflowId(supabase, attrs.tenantId),
  ]);

  if (error) throw error;
  return resolveWorkflowMappingFromRows(
    (mappings ?? []) as WorkflowMappingRow[],
    attrs,
    defaultId
  );
}

export function computeMappingPriority(input: {
  jobRole: string | null;
  employmentType: EmploymentType | null;
  placementType: PlacementType | null;
}): number {
  if (input.jobRole && input.employmentType && input.placementType) return 100;
  if (input.jobRole && input.employmentType) return 75;
  if (input.jobRole) return 50;
  return 0;
}
