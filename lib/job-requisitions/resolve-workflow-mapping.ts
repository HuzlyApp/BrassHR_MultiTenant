import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EmploymentType,
  JobRequisitionAttributes,
  JobSourceType,
  PlacementType,
  WorkflowMappingRow,
} from "@/lib/job-requisitions/types";

export type WorkflowMappingMatch = {
  workflowTemplateId: string;
  mappingId: string | null;
  matchLevel:
    | "exact"
    | "profession_specialty_employment_placement_source"
    | "profession_specialty_employment_placement"
    | "profession_specialty_employment"
    | "profession_specialty"
    | "profession"
    | "role_employment"
    | "role_only"
    | "tenant_default"
    | "none";
  priority: number;
  specificity: number;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function effectiveProfession(attrs: JobRequisitionAttributes): string {
  return normalizeText(attrs.profession ?? attrs.jobRole);
}

function mappingProfession(row: WorkflowMappingRow): string {
  return normalizeText(row.profession ?? row.job_role);
}

/**
 * Specificity score — higher wins. Precedence:
 * 1. Tenant + Profession + Specialty + Employment + Placement + Source
 * 2. Tenant + Profession + Specialty + Employment + Placement
 * 3. Tenant + Profession + Specialty + Employment
 * 4. Tenant + Profession + Specialty
 * 5. Tenant + Profession
 * 6. Tenant default
 */
export function mappingSpecificity(row: WorkflowMappingRow): number {
  let score = 0;
  if (mappingProfession(row)) score += 16;
  if (row.specialty) score += 8;
  if (row.employment_type) score += 4;
  if (row.placement_type) score += 2;
  if (row.source_type) score += 1;
  return score;
}

function mappingMatches(
  row: WorkflowMappingRow,
  attrs: JobRequisitionAttributes
): boolean {
  const rowProfession = mappingProfession(row);
  if (rowProfession && rowProfession !== effectiveProfession(attrs)) {
    return false;
  }
  if (row.specialty && normalizeText(row.specialty) !== normalizeText(attrs.specialty)) {
    return false;
  }
  if (row.employment_type && row.employment_type !== attrs.employmentType) {
    return false;
  }
  if (row.placement_type && row.placement_type !== attrs.placementType) {
    return false;
  }
  if (row.source_type && row.source_type !== (attrs.sourceType ?? null)) {
    return false;
  }
  return true;
}

function matchLevelFromRow(row: WorkflowMappingRow): WorkflowMappingMatch["matchLevel"] {
  const hasProfession = Boolean(mappingProfession(row));
  const hasSpecialty = Boolean(row.specialty);
  const hasEmployment = Boolean(row.employment_type);
  const hasPlacement = Boolean(row.placement_type);
  const hasSource = Boolean(row.source_type);

  if (hasProfession && hasSpecialty && hasEmployment && hasPlacement && hasSource) {
    return "profession_specialty_employment_placement_source";
  }
  if (hasProfession && hasSpecialty && hasEmployment && hasPlacement) {
    return "profession_specialty_employment_placement";
  }
  if (hasProfession && hasSpecialty && hasEmployment) {
    return "profession_specialty_employment";
  }
  if (hasProfession && hasSpecialty) return "profession_specialty";
  if (hasProfession && hasEmployment && hasPlacement) return "exact";
  if (hasProfession && hasEmployment) return "role_employment";
  if (hasProfession) return "profession";
  if (!hasProfession && !hasSpecialty && !hasEmployment && !hasPlacement && !hasSource) {
    return "tenant_default";
  }
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
      specificity: mappingSpecificity(best),
    };
  }

  if (defaultWorkflowTemplateId) {
    return {
      workflowTemplateId: defaultWorkflowTemplateId,
      mappingId: null,
      matchLevel: "tenant_default",
      priority: 0,
      specificity: 0,
    };
  }

  return {
    workflowTemplateId: "",
    mappingId: null,
    matchLevel: "none",
    priority: -1,
    specificity: -1,
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
        "id, tenant_id, job_role, profession, specialty, employment_type, placement_type, source_type, workflow_template_id, priority, is_active"
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
  jobRole?: string | null;
  profession?: string | null;
  specialty?: string | null;
  employmentType: EmploymentType | null;
  placementType: PlacementType | null;
  sourceType?: JobSourceType | null;
}): number {
  const profession = input.profession ?? input.jobRole;
  if (
    profession &&
    input.specialty &&
    input.employmentType &&
    input.placementType &&
    input.sourceType
  ) {
    return 100;
  }
  if (profession && input.specialty && input.employmentType && input.placementType) {
    return 90;
  }
  if (profession && input.specialty && input.employmentType) return 80;
  if (profession && input.specialty) return 70;
  if (profession && input.employmentType && input.placementType) return 100;
  if (profession && input.employmentType) return 75;
  if (profession) return 50;
  return 0;
}
