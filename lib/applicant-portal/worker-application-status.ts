import {
  applicantStatusLabel,
  normalizeApplicantStatus,
  type ApplicationStatusKey,
} from "@/lib/applicant-portal";
import {
  applicationStatusLabel,
  normalizeApplicationStatus,
} from "@/lib/jobs/application-status";

/** Worker-profile Applications table + pipeline verification step. */
export function resolveWorkerApplicationStatusLabel(input: {
  applicationStatus: string;
  submittedAt: string | null;
  workerStatus?: string | null;
  allStepsComplete?: boolean;
}): string {
  const workerKey = normalizeApplicantStatus(input.workerStatus);
  const appKey = normalizeApplicationStatus(input.applicationStatus);
  const submitted = Boolean(input.submittedAt?.trim());
  const complete = input.allStepsComplete === true;

  if (input.allStepsComplete === false) {
    return "Pending";
  }

  if (!submitted && !complete) {
    return "Pending";
  }

  if (workerKey === "approved" || appKey === "hired") {
    return "Approved";
  }

  if (workerKey === "rejected" || appKey === "rejected") {
    return "Not Selected";
  }

  if (!submitted) {
    return "Pending";
  }

  if (workerKey === "under_review") {
    return "Under Review";
  }

  if (appKey === "new") {
    return "Submitted";
  }

  return applicationStatusLabel(input.applicationStatus);
}

export function workerApplicationStatusTextClass(statusLabel: string): string {
  const value = statusLabel.toLowerCase();
  if (value.includes("not selected") || value.includes("reject")) return "text-[#EF4444]";
  if (value.includes("approved")) return "text-[#16A34A]";
  if (value.includes("under review") || value.includes("submitted")) return "text-[#3B82F6]";
  if (value.includes("pending") || value.includes("in progress")) return "text-[#F59E0B]";
  return "text-[#3B82F6]";
}

export function resolveVerificationPipelineStatus(input: {
  submittedAt: string | null;
  workerStatus?: string | null;
  allStepsComplete?: boolean;
}): {
  status: "completed" | "in_progress" | "pending";
  statusLabel: string;
  workerVerificationStatus: ApplicationStatusKey;
  workerVerificationLabel: string;
} {
  const workerKey = normalizeApplicantStatus(input.workerStatus);
  const workerVerificationLabel = applicantStatusLabel(input.workerStatus);
  const submitted = Boolean(input.submittedAt?.trim());
  const complete = Boolean(input.allStepsComplete);

  if (complete && workerKey === "approved") {
    return {
      status: "completed",
      statusLabel: "Approved",
      workerVerificationStatus: workerKey,
      workerVerificationLabel,
    };
  }

  if (!complete) {
    return {
      status: "pending",
      statusLabel: "Pending",
      workerVerificationStatus: workerKey,
      workerVerificationLabel,
    };
  }

  if (workerKey === "approved") {
    return {
      status: "completed",
      statusLabel: "Approved",
      workerVerificationStatus: workerKey,
      workerVerificationLabel,
    };
  }

  if (workerKey === "rejected") {
    return {
      status: "completed",
      statusLabel: "Not Selected",
      workerVerificationStatus: workerKey,
      workerVerificationLabel,
    };
  }

  if (!submitted) {
    return {
      status: "pending",
      statusLabel: "Pending",
      workerVerificationStatus: workerKey,
      workerVerificationLabel,
    };
  }

  return {
    status: "in_progress",
    statusLabel: workerVerificationLabel,
    workerVerificationStatus: workerKey,
    workerVerificationLabel,
  };
}
