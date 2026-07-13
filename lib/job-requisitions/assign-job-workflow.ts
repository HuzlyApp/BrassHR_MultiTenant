import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  resolveWorkflowMapping,
  type WorkflowMappingMatch,
} from "@/lib/job-requisitions/resolve-workflow-mapping";
import {
  WORKFLOW_CONFIG_PATH,
  WORKFLOW_MAPPING_MISSING_MESSAGE,
  type EmploymentType,
  type JobRequisitionStatus,
  type PlacementType,
} from "@/lib/job-requisitions/types";

export type JobWorkflowAssignmentInput = {
  tenantId: string;
  jobRole: string | null;
  employmentType: EmploymentType;
  placementType: PlacementType;
  status: JobRequisitionStatus;
  actorUserId?: string | null;
  request?: Request;
};

export type JobWorkflowAssignmentResult =
  | {
      ok: true;
      workflowTemplateId: string;
      match: WorkflowMappingMatch;
      publicJobToken: string | null;
    }
  | {
      ok: false;
      error: string;
      configPath: string;
      match: WorkflowMappingMatch;
    };

const PUBLISHABLE_STATUSES = new Set<JobRequisitionStatus>(["Open"]);

function generatePublicJobToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function assignWorkflowToJobRequisition(
  supabase: SupabaseClient,
  input: JobWorkflowAssignmentInput
): Promise<JobWorkflowAssignmentResult> {
  const match = await resolveWorkflowMapping(supabase, {
    tenantId: input.tenantId,
    jobRole: input.jobRole,
    employmentType: input.employmentType,
    placementType: input.placementType,
  });

  if (!match.workflowTemplateId) {
    void writeActivityLog({
      actorUserId: input.actorUserId ?? null,
      action: "job_workflow_assignment_failed",
      entityType: "job_requisitions",
      tenantId: input.tenantId,
      metadata: {
        job_role: input.jobRole,
        employment_type: input.employmentType,
        placement_type: input.placementType,
        match_level: match.matchLevel,
      },
      request: input.request,
    });

    return {
      ok: false,
      error: WORKFLOW_MAPPING_MISSING_MESSAGE,
      configPath: WORKFLOW_CONFIG_PATH,
      match,
    };
  }

  const { data: flow, error: flowErr } = await supabase
    .from("onboarding_flows")
    .select("id, status, is_active")
    .eq("id", match.workflowTemplateId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (flowErr) throw flowErr;
  if (!flow?.id || flow.is_active === false) {
    return {
      ok: false,
      error: "The mapped workflow template is inactive or missing.",
      configPath: WORKFLOW_CONFIG_PATH,
      match,
    };
  }

  if (PUBLISHABLE_STATUSES.has(input.status) && flow.status !== "published") {
    return {
      ok: false,
      error:
        "The mapped workflow must be published before this job can accept applicants.",
      configPath: WORKFLOW_CONFIG_PATH,
      match,
    };
  }

  void writeActivityLog({
    actorUserId: input.actorUserId ?? null,
    action: "job_workflow_automatically_assigned",
    entityType: "job_requisitions",
    tenantId: input.tenantId,
    metadata: {
      workflow_template_id: match.workflowTemplateId,
      mapping_id: match.mappingId,
      match_level: match.matchLevel,
      priority: match.priority,
    },
    request: input.request,
  });

  return {
    ok: true,
    workflowTemplateId: match.workflowTemplateId,
    match,
    publicJobToken: PUBLISHABLE_STATUSES.has(input.status)
      ? generatePublicJobToken()
      : null,
  };
}

export type PersistJobWorkflowPatch = {
  workflow_template_id: string | null;
  workflow_assignment_error: string | null;
  onboarding_workflow_id: string | null;
  public_job_token?: string | null;
};

export function buildJobWorkflowPatch(
  result: JobWorkflowAssignmentResult,
  existingToken: string | null,
  status: JobRequisitionStatus
): PersistJobWorkflowPatch {
  if (!result.ok) {
    return {
      workflow_template_id: null,
      workflow_assignment_error: result.error,
      onboarding_workflow_id: null,
      public_job_token: PUBLISHABLE_STATUSES.has(status) ? null : existingToken,
    };
  }

  return {
    workflow_template_id: result.workflowTemplateId,
    workflow_assignment_error: null,
    onboarding_workflow_id: result.workflowTemplateId,
    public_job_token: PUBLISHABLE_STATUSES.has(status)
      ? result.publicJobToken ?? existingToken ?? generatePublicJobToken()
      : existingToken,
  };
}
