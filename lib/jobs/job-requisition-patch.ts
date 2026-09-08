import { JobValidationError, type JobStatus } from "@/lib/jobs/types";
import {
  canTransitionJobStatus,
  isJobStatus,
  normalizeJobRequisitionStatus,
} from "@/lib/jobs/job-status";

export type JobRequisitionPatchInput = {
  status?: JobStatus | string | null;
  /** FSD assignee — auth user id or null to clear. */
  assignee?: string | null;
  assignedRecruiterUserId?: string | null;
  tags?: string[] | null;
  isHot?: boolean | null;
  is_hot?: boolean | null;
};

const MAX_JOB_TAGS = 30;
const MAX_TAG_LENGTH = 48;

/** Normalize free-form job tags (trim, dedupe, length limits). */
export function normalizeJobTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const tag = String(item ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag.slice(0, MAX_TAG_LENGTH));
    if (out.length >= MAX_JOB_TAGS) break;
  }
  return out;
}

export function parseJobRequisitionPatch(body: unknown): JobRequisitionPatchInput {
  if (!body || typeof body !== "object") {
    throw new JobValidationError("Invalid patch body.", {}, "INVALID_PATCH");
  }
  const record = body as Record<string, unknown>;
  const patch: JobRequisitionPatchInput = {};

  if ("status" in record) {
    const status = String(record.status ?? "").trim().toLowerCase();
    if (!status || (!isJobStatus(status) && status !== "published")) {
      throw new JobValidationError("Invalid status.", { status: "Invalid status." }, "INVALID_STATUS");
    }
    patch.status = normalizeJobRequisitionStatus(status);
  }

  if ("assignee" in record || "assignedRecruiterUserId" in record) {
    const raw =
      "assignee" in record ? record.assignee : record.assignedRecruiterUserId;
    if (raw === null || raw === "") {
      patch.assignee = null;
    } else if (typeof raw === "string" && raw.trim()) {
      patch.assignee = raw.trim();
    } else {
      throw new JobValidationError(
        "Invalid assignee.",
        { assignee: "Assignee must be a user id or null." },
        "INVALID_ASSIGNEE"
      );
    }
  }

  if ("tags" in record) {
    if (record.tags === null) {
      patch.tags = [];
    } else if (Array.isArray(record.tags)) {
      patch.tags = normalizeJobTags(record.tags);
    } else {
      throw new JobValidationError(
        "Invalid tags.",
        { tags: "Tags must be an array of strings." },
        "INVALID_TAGS"
      );
    }
  }

  if ("is_hot" in record || "isHot" in record) {
    const raw = "is_hot" in record ? record.is_hot : record.isHot;
    if (typeof raw !== "boolean") {
      throw new JobValidationError(
        "Invalid is_hot.",
        { is_hot: "is_hot must be a boolean." },
        "INVALID_IS_HOT"
      );
    }
    patch.isHot = raw;
  }

  if (
    patch.status === undefined &&
    patch.assignee === undefined &&
    patch.tags === undefined &&
    patch.isHot === undefined
  ) {
    throw new JobValidationError(
      "No updatable fields provided.",
      {},
      "EMPTY_PATCH"
    );
  }

  return patch;
}

export function assertCanPatchJobStatus(
  from: string | null | undefined,
  to: string | null | undefined
) {
  if (!canTransitionJobStatus(from, to) && normalizeJobRequisitionStatus(from) !== normalizeJobRequisitionStatus(to)) {
    throw new JobValidationError(
      `Cannot change job status from ${normalizeJobRequisitionStatus(from)} to ${normalizeJobRequisitionStatus(to)}.`,
      {},
      "JOB_STATUS_TRANSITION_INVALID"
    );
  }
}
