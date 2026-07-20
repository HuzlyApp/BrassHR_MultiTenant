import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkflowMatch, WorkflowMatchKey } from "@/lib/jobs/types";
import { workflowNoMatchMessage } from "@/lib/jobs/validation";
import {
  WorkflowMappingError,
  type WorkflowMappingInput,
  type WorkflowMappingListItem,
  type WorkflowResolveResult,
} from "@/lib/workflow-mappings/types";
import { validateWorkflowCompatibility } from "@/lib/workflow-mappings/validation";

type DbClient = SupabaseClient;

const MAPPING_SELECT =
  "id, tenant_id, profession_id, employment_type, workflow_id, is_active, priority, created_at, updated_at, professions(name), onboarding_flows(id, name, status, tenant_id)";

export async function resolveWorkflowMatch(
  supabase: DbClient,
  tenantId: string,
  key: WorkflowMatchKey
): Promise<WorkflowMatch | null> {
  const { data, error } = await supabase
    .from("workflow_mappings")
    .select("id, workflow_id, priority, onboarding_flows!inner(id, name, status, tenant_id)")
    .eq("tenant_id", tenantId)
    .eq("profession_id", key.professionId)
    .eq("employment_type", key.employmentType)
    .eq("is_active", true)
    .eq("onboarding_flows.status", "published")
    .eq("onboarding_flows.tenant_id", tenantId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const flow = Array.isArray(data.onboarding_flows)
    ? data.onboarding_flows[0]
    : data.onboarding_flows;
  if (!flow?.name) return null;

  return {
    mappingId: String(data.id),
    workflowId: String(data.workflow_id),
    workflowName: String(flow.name),
  };
}

export async function resolveWorkflowForCriteria(
  supabase: DbClient,
  tenantId: string,
  key: WorkflowMatchKey
): Promise<WorkflowResolveResult> {
  const match = await resolveWorkflowMatch(supabase, tenantId, key);
  if (match) {
    return {
      matched: true,
      mappingId: match.mappingId,
      workflowId: match.workflowId,
      workflowName: match.workflowName,
    };
  }

  const { data: profession } = await supabase
    .from("professions")
    .select("name")
    .eq("id", key.professionId)
    .maybeSingle();

  return {
    matched: false,
    workflowId: null,
    message: workflowNoMatchMessage(String(profession?.name ?? key.professionId), key),
  };
}

function toListItem(row: Record<string, unknown>): WorkflowMappingListItem {
  const profession = Array.isArray(row.professions) ? row.professions[0] : row.professions;
  const flow = Array.isArray(row.onboarding_flows) ? row.onboarding_flows[0] : row.onboarding_flows;
  return {
    id: String(row.id),
    professionId: String(row.profession_id),
    professionName: String((profession as { name?: string } | null)?.name ?? row.profession_id),
    employmentType: row.employment_type as WorkflowMappingListItem["employmentType"],
    workflowId: String(row.workflow_id),
    workflowName: String((flow as { name?: string } | null)?.name ?? row.workflow_id),
    workflowEmploymentType:
      ((flow as { employment_type?: string | null } | null)?.employment_type as string | null) ?? null,
    isActive: row.is_active === true,
    priority: Number(row.priority) || 100,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listWorkflowMappings(
  supabase: DbClient,
  tenantId: string,
  filters?: {
    professionId?: string;
    employmentType?: string;
    activeOnly?: boolean;
  }
): Promise<WorkflowMappingListItem[]> {
  let query = supabase
    .from("workflow_mappings")
    .select(MAPPING_SELECT)
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (filters?.professionId) query = query.eq("profession_id", filters.professionId);
  if (filters?.employmentType) query = query.eq("employment_type", filters.employmentType);
  if (filters?.activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => toListItem(row as Record<string, unknown>));
}

async function loadPublishedWorkflow(
  supabase: DbClient,
  tenantId: string,
  workflowId: string
) {
  const { data, error } = await supabase
    .from("onboarding_flows")
    .select("id, tenant_id, name, status, employment_type")
    .eq("id", workflowId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new WorkflowMappingError("Workflow not found.", "WORKFLOW_NOT_FOUND");
  return data;
}

export async function saveWorkflowMapping(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  input: WorkflowMappingInput
): Promise<WorkflowMappingListItem> {
  if (!input.professionId || !input.employmentType || !input.workflowId) {
    throw new WorkflowMappingError("All mapping criteria and a workflow are required.", "INVALID_INPUT", {
      professionId: "Profession is required.",
      employmentType: "Employment type is required.",
      workflowId: "Published workflow is required.",
    });
  }

  const workflow = await loadPublishedWorkflow(supabase, tenantId, input.workflowId);
  if (workflow.status !== "published") {
    throw new WorkflowMappingError("Only published workflows can be mapped.", "WORKFLOW_NOT_PUBLISHED", {
      workflowId: "Select a published workflow.",
    });
  }

  const workflowEmploymentType =
    (workflow as { employment_type?: string | null }).employment_type ?? null;
  const compatibilityError = validateWorkflowCompatibility(input, {
    id: String(workflow.id),
    tenantId: String(workflow.tenant_id),
    name: String(workflow.name),
    status: String(workflow.status),
    employmentType: workflowEmploymentType,
  });
  if (compatibilityError) {
    throw new WorkflowMappingError(compatibilityError, "INCOMPATIBLE_WORKFLOW", {
      workflowId: compatibilityError,
    });
  }

  const row = {
    tenant_id: tenantId,
    profession_id: input.professionId,
    employment_type: input.employmentType,
    workflow_id: input.workflowId,
    is_active: input.isActive ?? true,
    priority: input.priority ?? 100,
    updated_by: actorUserId,
  };

  const query = input.id
    ? supabase
        .from("workflow_mappings")
        .update(row)
        .eq("id", input.id)
        .eq("tenant_id", tenantId)
    : supabase.from("workflow_mappings").insert({ ...row, created_by: actorUserId });

  const { data, error } = await query.select(MAPPING_SELECT).single();
  if (error) {
    if (error.code === "23505") {
      throw new WorkflowMappingError(
        "An active mapping already exists for this profession and employment type.",
        "DUPLICATE_MAPPING"
      );
    }
    throw error;
  }

  return toListItem(data as Record<string, unknown>);
}

export async function deleteWorkflowMapping(
  supabase: DbClient,
  tenantId: string,
  mappingId: string
): Promise<{ deleted: boolean; deactivated: boolean }> {
  const { data: mapping, error: loadError } = await supabase
    .from("workflow_mappings")
    .select("id, workflow_id")
    .eq("id", mappingId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!mapping) throw new WorkflowMappingError("Mapping not found.", "NOT_FOUND");

  let referencedJobCount = 0;
  const { count, error: countError } = await supabase
    .from("job_requisitions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("workflow_id", mapping.workflow_id)
    .neq("status", "archived");

  if (countError) {
    const message = countError.message.toLowerCase();
    if (!message.includes("workflow_id") && !message.includes("does not exist")) {
      throw countError;
    }
  } else {
    referencedJobCount = count ?? 0;
  }

  if (referencedJobCount > 0) {
    const { error: deactivateError } = await supabase
      .from("workflow_mappings")
      .update({ is_active: false })
      .eq("id", mappingId)
      .eq("tenant_id", tenantId);
    if (deactivateError) throw deactivateError;
    return { deleted: false, deactivated: true };
  }

  const { error: deleteError } = await supabase
    .from("workflow_mappings")
    .delete()
    .eq("id", mappingId)
    .eq("tenant_id", tenantId);
  if (deleteError) throw deleteError;
  return { deleted: true, deactivated: false };
}

export async function listPublishedWorkflowOptions(
  supabase: DbClient,
  tenantId: string,
  filters?: { employmentType?: string }
) {
  let query = supabase
    .from("onboarding_flows")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("name", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).filter((row) => {
    if (!filters?.employmentType) return true;
    const workflowEmployment = (row as { employment_type?: string | null }).employment_type ?? null;
    if (!workflowEmployment) return true;
    if (filters.employmentType === "W2") return workflowEmployment !== "1099";
    if (filters.employmentType === "1099") return workflowEmployment !== "W2";
    return workflowEmployment === filters.employmentType;
  });
}
