import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import { dedupeJobApplicationsByJob } from "@/lib/applicant-portal/dedupe-job-applications";
import {
  type MeApplicationItem,
  type MeApplicationStage,
  type MeApplicationsPayload,
  type MeApplicationsSummary,
} from "@/lib/applicant-portal/me-applications-shared";
import { resolveWorkerApplicationStatusLabel } from "@/lib/applicant-portal/worker-application-status";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

export type {
  MeApplicationItem,
  MeApplicationStage,
  MeApplicationsPayload,
  MeApplicationsSummary,
} from "@/lib/applicant-portal/me-applications-shared";
export { buildApplicationsInsight } from "@/lib/applicant-portal/me-applications-shared";

const STATUS_CHART_COLORS: Record<string, string> = {
  new: "#3B82F6",
  reviewing: "#F59E0B",
  interviewing: "#8B5CF6",
  shortlisted: "#22C55E",
  hired: "#16A34A",
  rejected: "#EF4444",
  undecided: "#94A3B8",
  archived: "#64748B",
};

const WORK_TYPE_COLORS: Record<string, string> = {
  W2: "#3B82F6",
  "1099": "#22C55E",
  Contract: "#8B5CF6",
};

function normalizeEmploymentType(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "1099") return "1099";
  if (raw === "CONTRACT") return "Contract";
  return "W2";
}

function employmentTypeLabel(value: string): string {
  if (value === "1099") return "1099";
  if (value === "Contract") return "Contract";
  return "W2";
}

export function resolveApplicationStage(
  status: string,
  submittedAt: string | null,
  workerStatus?: string | null,
  allStepsComplete?: boolean
): MeApplicationStage {
  const normalized = normalizeApplicationStatus(status);
  const workerKey = workerStatus?.trim().toLowerCase();
  if (
    workerKey === "approved" &&
    allStepsComplete &&
    (submittedAt || allStepsComplete || normalized === "hired")
  ) {
    return {
      label: "Final Review",
      sublabel: "Approved",
      progressPercent: 100,
      barColor: "#16A34A",
    };
  }

  if (allStepsComplete === false || (!submittedAt && allStepsComplete !== true)) {
    return {
      label: "Application",
      sublabel: "Pending",
      progressPercent: 20,
      barColor: "#F59E0B",
    };
  }
  switch (normalized) {
    case "new":
      return {
        label: "Application Review",
        sublabel: "Initial Screening",
        progressPercent: 35,
        barColor: "#3B82F6",
      };
    case "reviewing":
      return {
        label: "Application Review",
        sublabel: "Under Review",
        progressPercent: 45,
        barColor: "#3B82F6",
      };
    case "interviewing":
      return {
        label: "Interview",
        sublabel: "HR Interview",
        progressPercent: 65,
        barColor: "#8B5CF6",
      };
    case "shortlisted":
      return {
        label: "Final Interview",
        sublabel: "Final Decision",
        progressPercent: 85,
        barColor: "#7C3AED",
      };
    case "hired":
      return {
        label: "Final Review",
        sublabel: "Approved",
        progressPercent: 100,
        barColor: "#16A34A",
      };
    case "rejected":
      return {
        label: "Application",
        sublabel: "Not Selected",
        progressPercent: 100,
        barColor: "#EF4444",
      };
    default:
      return {
        label: "Application Review",
        sublabel: "In Progress",
        progressPercent: 40,
        barColor: "#3B82F6",
      };
  }
}

function buildSummary(applications: MeApplicationItem[]): MeApplicationsSummary {
  const w2Count = applications.filter((app) => app.job.employmentType === "W2").length;
  const count1099 = applications.filter((app) => app.job.employmentType === "1099").length;

  const statusMap = new Map<string, { label: string; count: number; color: string }>();
  for (const app of applications) {
    const key = app.statusKey;
    const existing = statusMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      statusMap.set(key, {
        label: app.statusLabel,
        count: 1,
        color: STATUS_CHART_COLORS[key] ?? "#94A3B8",
      });
    }
  }

  const workTypeMap = new Map<string, { label: string; count: number; color: string }>();
  for (const app of applications) {
    const key = app.job.employmentType;
    const existing = workTypeMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      workTypeMap.set(key, {
        label: app.job.employmentTypeLabel,
        count: 1,
        color: WORK_TYPE_COLORS[key] ?? "#94A3B8",
      });
    }
  }

  const dominantStatus =
    applications.find((app) => app.statusKey === "interviewing") ??
    applications.find((app) => app.statusKey === "reviewing") ??
    applications[0];

  return {
    total: applications.length,
    w2Count,
    count1099,
    overallStatusLabel: dominantStatus?.statusLabel ?? "In Progress",
    statusCounts: [...statusMap.entries()].map(([key, value]) => ({ key, ...value })),
    workTypeCounts: [...workTypeMap.entries()].map(([key, value]) => ({ key, ...value })),
  };
}

export async function loadMeApplications(
  supabase: SupabaseClient,
  input: { workerIds: string[]; tenantIds: string[]; applicantAuthUserId: string }
): Promise<MeApplicationsPayload> {
  const { workerIds, tenantIds, applicantAuthUserId } = input;

  const { data: apps, error } = await supabase
    .from("job_applications")
    .select(
      "id, status, created_at, submitted_at, worker_id, tenant_id, job_requisition_id, applicant_auth_user_id, job_requisitions(id, public_title, location, facility, facility_name, employment_type), tenants:tenant_id(id, name, slug)"
    )
    .in("tenant_id", tenantIds)
    .not("status", "eq", "withdrawn")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const workerIdSet = new Set(workerIds);
  const scopedApps = (apps ?? []).filter((row) => {
    const workerId = row.worker_id ? String(row.worker_id) : "";
    const authUserId = row.applicant_auth_user_id ? String(row.applicant_auth_user_id) : "";
    return workerIdSet.has(workerId) || authUserId === applicantAuthUserId;
  });

  const workerStatusById = new Map<string, string>();
  const workerTenantById = new Map<string, string>();
  if (workerIds.length) {
    const { data: workers, error: workersError } = await supabase
      .from("worker")
      .select("id, status, tenant_id")
      .in("id", workerIds);
    if (workersError) throw workersError;
    for (const worker of workers ?? []) {
      if (worker?.id) {
        workerStatusById.set(String(worker.id), String(worker.status ?? ""));
        if (worker.tenant_id) workerTenantById.set(String(worker.id), String(worker.tenant_id));
      }
    }
  }

  const allStepsCompleteByWorker = new Map<string, boolean>();
  await Promise.all(
    [...workerTenantById.entries()].map(async ([workerId, tenantId]) => {
      try {
        const [progress, config] = await Promise.all([
          ensureWorkerOnboardingProgress(supabase, workerId, tenantId),
          loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true }),
        ]);
        const enabledSteps = getEnabledTenantSteps(config);
        const completeById = new Map(
          (progress.steps ?? []).map((step) => [step.onboarding_step_id, step.status])
        );
        const allComplete =
          enabledSteps.length > 0 &&
          enabledSteps.every((step) => {
            const status = completeById.get(step.id);
            return status === "completed" || status === "skipped";
          });
        allStepsCompleteByWorker.set(workerId, allComplete);
      } catch {
        allStepsCompleteByWorker.set(workerId, false);
      }
    })
  );

  const applications = dedupeJobApplicationsByJob(
    scopedApps.map((row) => {
    const jobRaw = row.job_requisitions;
    const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
    const tenantRaw = row.tenants;
    const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
    const tenantRecord = (tenant ?? {}) as {
      id?: string;
      name?: string | null;
      slug?: string | null;
    };
    const jobRecord = (job ?? {}) as {
      id?: string;
      public_title?: string | null;
      location?: string | null;
      facility?: string | null;
      facility_name?: string | null;
      employment_type?: string | null;
    };

    const status = String(row.status ?? "");
    const statusKey = normalizeApplicationStatus(status);
    const submittedAt = row.submitted_at ? String(row.submitted_at) : null;
    const employmentType = normalizeEmploymentType(jobRecord.employment_type);
    const facility =
      jobRecord.facility_name?.trim() || jobRecord.facility?.trim() || null;
    const tenantId = String(tenantRecord.id ?? row.tenant_id);
    const jobId = String(jobRecord.id ?? row.job_requisition_id);
    const rowWorkerId = row.worker_id ? String(row.worker_id) : "";
    const workerStatus = rowWorkerId ? workerStatusById.get(rowWorkerId) ?? null : null;

    const allStepsComplete = rowWorkerId
      ? allStepsCompleteByWorker.get(rowWorkerId) === true
      : false;

    return {
      applicationId: String(row.id),
      workerId: rowWorkerId,
      status,
      statusKey,
      statusLabel: resolveWorkerApplicationStatusLabel({
        applicationStatus: status,
        submittedAt,
        workerStatus,
        allStepsComplete,
      }),
      appliedAt: String(submittedAt ?? row.created_at ?? new Date().toISOString()),
      submittedAt,
      tenantId,
      jobId,
      tenant: {
        id: tenantId,
        name: tenantRecord.name?.trim() || tenantRecord.slug?.trim() || "Company",
      },
      job: {
        id: jobId,
        title: jobRecord.public_title?.trim() || "Job",
        location: jobRecord.location?.trim() || null,
        facility,
        employmentType,
        employmentTypeLabel: employmentTypeLabel(employmentType),
      },
      stage: resolveApplicationStage(status, submittedAt, workerStatus, allStepsComplete),
    } satisfies MeApplicationItem & { tenantId: string; jobId: string };
    })
  ).map(({ tenantId: _tenantId, jobId: _jobId, ...app }) => app);
  return {
    applications,
    summary: buildSummary(applications),
  };
}
