import type {
  ApplicantStepStatus,
  PublishedWorkflow,
} from "@/lib/onboarding/applicant-workflow-types";
import { normalizeWorkflowSteps } from "@/lib/onboarding/applicant-workflow";

type WorkflowKey = `${string}:${string}`;

type ApplicantSession = {
  applicationId: string;
  workflowId: string;
  workflowVersion: number;
  tenant: string;
};

const workflowVersions = new Map<WorkflowKey, PublishedWorkflow[]>();
const applicantSessions = new Map<string, ApplicantSession>();
const stepStatuses = new Map<string, ApplicantStepStatus>();

function workflowKey(tenant: string, workflowId: string): WorkflowKey {
  return `${tenant}:${workflowId}`;
}

function statusKey(
  applicationId: string,
  workflowId: string,
  workflowVersion: number,
  stepId: string
): string {
  return `${applicationId}:${workflowId}:v${workflowVersion}:${stepId}`;
}

export function resetApplicantWorkflowTestStore(): void {
  workflowVersions.clear();
  applicantSessions.clear();
  stepStatuses.clear();
}

export async function seedWorkflow(workflow: PublishedWorkflow): Promise<void> {
  const key = workflowKey(workflow.tenant, workflow.workflowId);
  const existing = workflowVersions.get(key) ?? [];
  const withoutVersion = existing.filter((w) => w.version !== workflow.version);
  workflowVersions.set(key, [...withoutVersion, workflow]);
}

function getPublishedWorkflows(tenant: string, workflowId: string): PublishedWorkflow[] {
  const key = workflowKey(tenant, workflowId);
  return (workflowVersions.get(key) ?? []).filter((w) => w.status === "published");
}

function getLatestPublishedWorkflow(
  tenant: string,
  workflowId: string
): PublishedWorkflow | null {
  const published = getPublishedWorkflows(tenant, workflowId);
  if (!published.length) return null;
  return published.slice().sort((a, b) => b.version - a.version)[0];
}

function getWorkflowVersion(
  tenant: string,
  workflowId: string,
  version: number
): PublishedWorkflow | null {
  const key = workflowKey(tenant, workflowId);
  return (workflowVersions.get(key) ?? []).find((w) => w.version === version) ?? null;
}

export async function seedApplicantWorkflowSession(session: {
  applicationId: string;
  workflowId: string;
  workflowVersion: number;
  tenant?: string;
}): Promise<void> {
  applicantSessions.set(session.applicationId, {
    applicationId: session.applicationId,
    workflowId: session.workflowId,
    workflowVersion: session.workflowVersion,
    tenant: session.tenant ?? "subdomaintest",
  });
}

export async function publishWorkflowToAll(workflow: PublishedWorkflow): Promise<void> {
  const key = workflowKey(workflow.tenant, workflow.workflowId);
  const existing = workflowVersions.get(key) ?? [];
  const demoted = existing.map((w) =>
    w.status === "published" && w.version !== workflow.version
      ? { ...w, status: "published" as const }
      : w
  );
  workflowVersions.set(key, [...demoted.filter((w) => w.version !== workflow.version), workflow]);
}

export async function getApplicantWorkflow(params: {
  tenant: string;
  applicationId: string;
  workflowId?: string;
}): Promise<PublishedWorkflow> {
  const workflowId = params.workflowId ?? "worker_onboarding";
  const session = applicantSessions.get(params.applicationId);

  if (session && session.workflowId === workflowId) {
    const pinned = getWorkflowVersion(params.tenant, workflowId, session.workflowVersion);
    if (pinned) return pinned;
    throw new Error(
      `Assigned workflow version ${session.workflowVersion} is no longer available`
    );
  }

  const latest = getLatestPublishedWorkflow(params.tenant, workflowId);
  if (!latest) {
    throw new Error("No published workflow found for applicant");
  }

  return latest;
}

export async function completeApplicantStep(input: {
  applicationId: string;
  workflowId: string;
  workflowVersion: number;
  stepId: string;
  status: ApplicantStepStatus["status"];
}): Promise<ApplicantStepStatus> {
  const completedAt =
    input.status === "completed" ? new Date().toISOString() : null;

  const record: ApplicantStepStatus = {
    applicationId: input.applicationId,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    stepId: input.stepId,
    status: input.status,
    completedAt,
  };

  stepStatuses.set(
    statusKey(
      input.applicationId,
      input.workflowId,
      input.workflowVersion,
      input.stepId
    ),
    record
  );

  return record;
}

export async function getApplicantStepStatus(input: {
  applicationId: string;
  workflowId: string;
  workflowVersion: number;
  stepId: string;
}): Promise<ApplicantStepStatus> {
  const key = statusKey(
    input.applicationId,
    input.workflowId,
    input.workflowVersion,
    input.stepId
  );
  const existing = stepStatuses.get(key);
  if (existing) return existing;

  return {
    applicationId: input.applicationId,
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    stepId: input.stepId,
    status: "not_started",
    completedAt: null,
  };
}

export async function getApplicantStepStatuses(input: {
  applicationId: string;
  workflow: PublishedWorkflow;
}): Promise<ApplicantStepStatus[]> {
  const steps = normalizeWorkflowSteps(input.workflow.steps);
  return Promise.all(
    steps.map((step) =>
      getApplicantStepStatus({
        applicationId: input.applicationId,
        workflowId: input.workflow.workflowId,
        workflowVersion: input.workflow.version,
        stepId: step.id,
      })
    )
  );
}

export function resolvePublishedWorkflowForApplicant(
  tenant: string,
  applicationId: string,
  workflowId = "worker_onboarding"
): PublishedWorkflow | null {
  const session = applicantSessions.get(applicationId);
  if (session) {
    return getWorkflowVersion(tenant, session.workflowId, session.workflowVersion);
  }
  return getLatestPublishedWorkflow(tenant, workflowId);
}

export function listWorkflowVersions(tenant: string, workflowId: string): PublishedWorkflow[] {
  const key = workflowKey(tenant, workflowId);
  return workflowVersions.get(key) ?? [];
}
