import type { SupabaseClient } from "@supabase/supabase-js";
import { isCandidateAlreadyConverted } from "@/lib/admin/convert-candidate-to-worker";
import type { AdminAttachmentRequirement } from "@/lib/onboarding/build-admin-attachment-requirements";
import { loadAdminAttachmentRequirements } from "@/lib/onboarding/load-admin-attachment-requirements";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { canRevealPostHire, isAuthoritativelyHired } from "@/lib/onboarding/lock-post-hire";
import { parseApplicantLifecyclePhase } from "@/lib/onboarding/workflow-phase";
import {
  type EmploymentJourneyStage,
  type EmploymentLifecyclePhase,
  type PhaseProgressCounts,
  resolveEmploymentJourneyStage,
} from "@/lib/onboarding/workflow-phase-groups";
import {
  type CandidateWorkflowAssignmentView,
  type MappedAssignedStep,
  type ProgressRowInput,
  buildPhaseAssignment,
  countsFromAssignedSteps,
  mapAssignedStepRecords,
  resolveAssignmentSource,
  sanitizeTagsForClient,
} from "@/lib/onboarding/assigned-workflow-steps";

export type { CandidateWorkflowAssignmentView } from "@/lib/onboarding/assigned-workflow-steps";

export type CandidateWorkflowTag = {
  id: string;
  workflowName: string;
  workflowType: string | null;
  phase: EmploymentLifecyclePhase | "both";
  version: string | null;
  assignedAt: string | null;
  assignmentState: "active" | "completed" | "replaced" | "archived";
  active: boolean;
};

export type CandidateWorkflowStepView = MappedAssignedStep;

export type CandidateWorkflowDocumentView = AdminAttachmentRequirement & {
  stepTitle: string;
};

export type CandidateWorkflowPhaseBlock = {
  assigned: boolean;
  progress: PhaseProgressCounts;
  steps: CandidateWorkflowStepView[];
  documents: CandidateWorkflowDocumentView[];
  assignment: CandidateWorkflowAssignmentView | null;
};

export type CandidateWorkflowPhaseView = {
  currentStage: EmploymentJourneyStage;
  isHired: boolean;
  hiredAt: string | null;
  hiredBy: string | null;
  postHireVisible: boolean;
  postHireUnlocked: boolean;
  postHireLocked: boolean;
  postHireSuspended: boolean;
  postHireActivationFailed: boolean;
  phaseStartedAt: string | null;
  workflowPhase: "pre_hire" | "post_hire" | "completed";
  currentWorkflowName: string | null;
  currentStepTitle: string | null;
  tags: CandidateWorkflowTag[];
  preHire: CandidateWorkflowPhaseBlock;
  postHire: CandidateWorkflowPhaseBlock | null;
};

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function assignmentStateOf(value: unknown): CandidateWorkflowTag["assignmentState"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "replaced" || raw === "archived" || raw === "completed") return raw;
  return "active";
}

function instanceHasPhase(
  records: Array<{ phase: EmploymentLifecyclePhase }>,
  phase: EmploymentLifecyclePhase
): boolean {
  return records.some((row) => row.phase === phase);
}

export async function loadCandidateWorkflowPhaseView(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    tenantId: string;
    resumeUrl?: string | null;
    resumePath?: string | null;
    resumePathRaw?: string | null;
    legacyUrls?: {
      nursing_license_url: string | null;
      tb_test_url: string | null;
      cpr_certification_url: string | null;
      authorization_document_url: string | null;
    };
  }
): Promise<CandidateWorkflowPhaseView> {
  const { workerId, tenantId } = params;

  const [applicationsRes, instancesRes, workerRes, config, progressRes, mappingsRes] = await Promise.all([
    supabase
      .from("job_applications")
      .select(
        "id, status, status_id, workflow_phase, post_hire_activated_at, post_hire_suspended_at, hired_at, hired_by, created_at, updated_at, workflow_id, applicant_workflow_instance_id"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applicant_workflow_instances")
      .select(
        "id, workflow_id, workflow_name, workflow_version, status, assignment_state, started_at, created_at, completed_at, post_hire_unlocked_at, pre_hire_completed_at, application_id, onboarding_flow_id, conversion_status, converted_worker_id, converted_at"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("worker")
      .select("status, converted_at, converted_worker_type, converted_worker_id, conversion_status")
      .eq("id", workerId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false }),
    supabase
      .from("worker_onboarding_step_progress")
      .select("onboarding_step_id, status, completed_at, created_at, updated_at, data")
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId),
    supabase.from("workflow_mappings").select("workflow_id").eq("tenant_id", tenantId).eq("is_active", true),
  ]);

  if (applicationsRes.error && !/hired_at|post_hire_suspended_at|does not exist/i.test(applicationsRes.error.message)) {
    throw applicationsRes.error;
  }
  if (instancesRes.error && !/assignment_state|does not exist/i.test(instancesRes.error.message)) {
    throw instancesRes.error;
  }

  const applications = (applicationsRes.data ?? []) as Array<Record<string, unknown>>;
  const instances = (instancesRes.data ?? []) as Array<Record<string, unknown>>;
  const primaryApp = applications[0] ?? null;
  const hiredApp = applications.find((row) => isAuthoritativelyHired(asText(row.status))) ?? null;
  const isHired = Boolean(hiredApp);
  const workflowPhase = parseApplicantLifecyclePhase(primaryApp?.workflow_phase);
  const postHireUnlockedAt = asText(
    hiredApp?.post_hire_activated_at ?? primaryApp?.post_hire_activated_at
  );
  const postHireSuspended = Boolean(
    asText(hiredApp?.post_hire_suspended_at ?? primaryApp?.post_hire_suspended_at)
  );
  const postHireUnlocked =
    isHired && Boolean(postHireUnlockedAt) && !postHireSuspended && workflowPhase !== "pre_hire";
  const postHireActivationFailed = isHired && !postHireUnlockedAt && workflowPhase === "pre_hire";

  const workerRow = (workerRes.data ?? {}) as Record<string, unknown>;
  const postHireVisible = canRevealPostHire({
    workerStatus: asText(workerRow.status),
    convertedAt: asText(workerRow.converted_at),
    convertedWorkerId: asText(workerRow.converted_worker_id),
    conversionStatus: asText(workerRow.conversion_status),
  });

  const progressByStepId = new Map<string, ProgressRowInput>();
  for (const row of (progressRes.data ?? []) as ProgressRowInput[]) {
    const id = asText(row.onboarding_step_id);
    if (!id) continue;
    progressByStepId.set(id, row);
  }

  const instanceIds = instances.map((row) => asText(row.id)).filter((id): id is string => Boolean(id));
  let stepRecords: Array<Record<string, unknown>> = [];
  if (instanceIds.length) {
    const { data, error } = await supabase
      .from("applicant_workflow_step_records")
      .select(
        "id, workflow_instance_id, snapshot_step_id, title, step_type, is_required, status, position, phase, settings, completed_at, created_at"
      )
      .eq("tenant_id", tenantId)
      .in("workflow_instance_id", instanceIds)
      .order("position", { ascending: true });
    if (error && !/does not exist/i.test(error.message)) throw error;
    stepRecords = (data ?? []) as Array<Record<string, unknown>>;
  }

  const activeInstance =
    instances.find((row) => assignmentStateOf(row.assignment_state ?? row.status) === "active") ??
    instances[0] ??
    null;
  const activeInstanceId = asText(activeInstance?.id);
  const activeRecords = stepRecords.filter((row) => asText(row.workflow_instance_id) === activeInstanceId);

  const tenantSteps = (config?.steps ?? []).filter((step) => step.is_enabled);
  const mappedSteps = mapAssignedStepRecords({
    records: activeRecords.map((row) => ({
      id: String(row.id),
      snapshot_step_id: String(row.snapshot_step_id ?? ""),
      title: String(row.title ?? "Step"),
      step_type: String(row.step_type ?? "custom-step"),
      is_required: row.is_required !== false,
      status: asText(row.status),
      position: typeof row.position === "number" ? row.position : 0,
      phase: asText(row.phase),
      settings:
        row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
          ? (row.settings as Record<string, unknown>)
          : {},
      completed_at: asText(row.completed_at),
      created_at: asText(row.created_at),
    })),
    tenantSteps,
    progressByStepId,
    assignedAt: asText(activeInstance?.started_at) ?? asText(activeInstance?.created_at),
  });

  const preHireSteps = mappedSteps.filter((step) => step.phase === "pre_hire");
  const postHireSteps = mappedSteps.filter((step) => step.phase === "post_hire");

  const documents = await loadAdminAttachmentRequirements({
    supabase,
    workerId,
    tenantId,
    resumeUrl: params.resumeUrl ?? null,
    resumePath: params.resumePath ?? null,
    resumePathRaw: params.resumePathRaw ?? null,
    legacyUrls: params.legacyUrls ?? {
      nursing_license_url: null,
      tb_test_url: null,
      cpr_certification_url: null,
      authorization_document_url: null,
    },
  }).catch(() => [] as AdminAttachmentRequirement[]);

  const mappedWorkflowIds = ((mappingsRes.data ?? []) as Array<{ workflow_id?: string }>)
    .map((row) => asText(row.workflow_id))
    .filter((id): id is string => Boolean(id));
  const assignmentSource = resolveAssignmentSource({
    workflowId: asText(activeInstance?.workflow_id) ?? asText(activeInstance?.onboarding_flow_id),
    mappedWorkflowIds,
  });

  const flowIds = [
    ...new Set(
      instances
        .map((row) => asText(row.workflow_id) ?? asText(row.onboarding_flow_id))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const flowsById = new Map<
    string,
    { name: string | null; employment_type: string | null; version: number | null }
  >();
  if (flowIds.length) {
    const { data: flows } = await supabase
      .from("onboarding_flows")
      .select("id, name, employment_type, version")
      .eq("tenant_id", tenantId)
      .in("id", flowIds);
    for (const flow of flows ?? []) {
      const row = flow as {
        id: string;
        name?: string | null;
        employment_type?: string | null;
        version?: number | null;
      };
      flowsById.set(String(row.id), {
        name: asText(row.name),
        employment_type: asText(row.employment_type),
        version: typeof row.version === "number" ? row.version : null,
      });
    }
  }

  const recordsByInstance = new Map<string, CandidateWorkflowStepView[]>();
  for (const record of stepRecords) {
    const instanceId = asText(record.workflow_instance_id);
    if (!instanceId) continue;
    const list = recordsByInstance.get(instanceId) ?? [];
    const phase =
      asText(record.phase) === "post_hire"
        ? "post_hire"
        : ("pre_hire" as EmploymentLifecyclePhase);
    list.push({
      id: String(record.id),
      snapshotStepId: String(record.snapshot_step_id ?? ""),
      tenantStepId: null,
      title: String(record.title ?? "Step"),
      stepKey: String(record.snapshot_step_id ?? ""),
      stepType: String(record.step_type ?? ""),
      onboardingType: "custom_question",
      phase,
      required: record.is_required !== false,
      status: "pending",
      displayStatus: "not_started",
      inspectable: true,
      unmatched: false,
      assignedAt: asText(record.created_at),
      completedAt: asText(record.completed_at),
    });
    recordsByInstance.set(instanceId, list);
  }

  const tags: CandidateWorkflowTag[] = instances.map((row, index) => {
    const workflowId = asText(row.workflow_id) ?? asText(row.onboarding_flow_id);
    const flow = workflowId ? flowsById.get(workflowId) : null;
    const assignmentState = assignmentStateOf(row.assignment_state ?? row.status);
    const name = asText(row.workflow_name) || flow?.name || "Workflow";
    const instanceSteps = recordsByInstance.get(asText(row.id) ?? "") ?? [];
    const hasPre = instanceHasPhase(instanceSteps, "pre_hire") || (row === activeInstance && preHireSteps.length > 0);
    const hasPost = instanceHasPhase(instanceSteps, "post_hire") || (row === activeInstance && postHireSteps.length > 0);
    return {
      id: asText(row.id) || `tag-${index}`,
      workflowName: name,
      workflowType: flow?.employment_type ?? null,
      phase: hasPre && hasPost ? "both" : hasPost ? "post_hire" : "pre_hire",
      version: asText(row.workflow_version) ?? (flow?.version != null ? String(flow.version) : null),
      assignedAt: asText(row.started_at) ?? asText(row.created_at),
      assignmentState,
      active:
        assignmentState === "active" &&
        !instances
          .slice(0, index)
          .some((prior) => assignmentStateOf(prior.assignment_state ?? prior.status) === "active"),
    };
  });

  const assignedAt = asText(activeInstance?.started_at) ?? asText(activeInstance?.created_at);
  const workflowName =
    asText(activeInstance?.workflow_name) ||
    (asText(activeInstance?.workflow_id)
      ? flowsById.get(asText(activeInstance?.workflow_id) ?? "")?.name
      : null) ||
    tags.find((tag) => tag.active)?.workflowName ||
    null;
  const workflowVersion = asText(activeInstance?.workflow_version);

  const toDocumentView = (doc: AdminAttachmentRequirement): CandidateWorkflowDocumentView => ({
    ...doc,
    stepTitle: doc.step_title?.trim() || doc.title,
  });

  const stepIds = new Set(mappedSteps.map((step) => step.tenantStepId).filter((id): id is string => Boolean(id)));
  const stepKeys = new Set(mappedSteps.map((step) => step.stepKey));
  const documentsForPhase = (phase: EmploymentLifecyclePhase, steps: CandidateWorkflowStepView[]) => {
    const ids = new Set(steps.map((step) => step.tenantStepId).filter((id): id is string => Boolean(id)));
    const keys = new Set(steps.map((step) => step.stepKey));
    return documents
      .filter((doc) => {
        if (doc.phase !== phase) return false;
        if (ids.size && doc.required_document_id) {
          const tenantDocStep = steps.find((step) => step.stepKey === doc.step_key);
          if (tenantDocStep) return true;
        }
        return keys.has(doc.step_key) || stepKeys.has(doc.step_key) || stepIds.has(doc.id);
      })
      .map(toDocumentView);
  };

  const preHireAssignment =
    preHireSteps.length || workflowName
      ? buildPhaseAssignment({
          workflowName,
          version: workflowVersion,
          assignedAt,
          assignmentSource,
          phase: "pre_hire",
          steps: preHireSteps,
        })
      : null;
  const postHireAssignment =
    postHireSteps.length || workflowName
      ? buildPhaseAssignment({
          workflowName,
          version: workflowVersion,
          assignedAt,
          assignmentSource,
          phase: "post_hire",
          steps: postHireSteps,
        })
      : null;

  const currentStep =
    (postHireVisible ? mappedSteps : preHireSteps).find((step) => step.status === "in_progress") ??
    (postHireVisible ? mappedSteps : preHireSteps).find(
      (step) => step.status === "pending" || step.status === "failed"
    ) ??
    null;

  const onboarded = isCandidateAlreadyConverted(workerRow);
  const currentStage = resolveEmploymentJourneyStage({
    isHired: postHireVisible || isHired,
    workflowPhase: postHireVisible ? workflowPhase : workflowPhase === "post_hire" ? "pre_hire" : workflowPhase,
    hasPreHireWorkflow: preHireSteps.length > 0 || tags.some((tag) => tag.phase !== "post_hire"),
    hasPostHireWorkflow: postHireVisible && (postHireSteps.length > 0 || tags.some((tag) => tag.phase !== "pre_hire")),
    postHireUnlocked: postHireVisible && postHireUnlocked,
    onboarded: postHireVisible && onboarded,
  });

  const view: CandidateWorkflowPhaseView = {
    currentStage,
    isHired,
    hiredAt: asText(hiredApp?.hired_at) ?? (isHired ? asText(hiredApp?.updated_at) : null),
    hiredBy: asText(hiredApp?.hired_by),
    postHireVisible,
    postHireUnlocked: postHireVisible && postHireUnlocked,
    postHireLocked: !postHireVisible,
    postHireSuspended,
    postHireActivationFailed: postHireVisible && postHireActivationFailed,
    phaseStartedAt:
      currentStage === "post_hire"
        ? postHireUnlockedAt
        : asText(primaryApp?.created_at) ?? asText(activeInstance?.started_at),
    workflowPhase,
    currentWorkflowName: workflowName,
    currentStepTitle: currentStep?.title ?? null,
    tags: sanitizeTagsForClient(tags, postHireVisible),
    preHire: {
      assigned: preHireSteps.length > 0,
      progress: countsFromAssignedSteps(preHireSteps, "pre_hire"),
      steps: preHireSteps,
      documents: documentsForPhase("pre_hire", preHireSteps),
      assignment: preHireSteps.length ? preHireAssignment : null,
    },
    postHire: postHireVisible
      ? {
          assigned: postHireSteps.length > 0,
          progress: countsFromAssignedSteps(postHireSteps, "post_hire"),
          steps: postHireSteps,
          documents: documentsForPhase("post_hire", postHireSteps),
          assignment: postHireSteps.length ? postHireAssignment : null,
        }
      : null,
  };

  return view;
}
