import type { EmploymentType, JobRequisitionInput, PlacementType, SourceType } from "@/lib/jobs/types";

export const PLACEMENT_TYPE_LABELS: Record<PlacementType, string> = {
  Internal: "Internal",
  Recruit_and_Release: "Recruit & Release (R&R)",
  Recruit_and_EOR: "Recruit & EOR",
};

/** User-facing summary for the MSP job-source placement banner (avoid confusing R&R with EOR). */
export const MSP_PLACEMENT_SUMMARIES: Record<
  "Recruit_and_Release" | "Recruit_and_EOR",
  { title: string; lines: string[] }
> = {
  Recruit_and_Release: {
    title: "Recruit & Release (R&R)",
    lines: [
      "You recruit candidates for jobs posted by the MSP.",
      "The MSP employs the placed worker after hire.",
      "Commission-based fee — assign an applicant workflow for this placement.",
    ],
  },
  Recruit_and_EOR: {
    title: "Recruit & EOR",
    lines: [
      "Your tenant recruits and employs the worker (W2 or 1099).",
      "Worker is assigned to the MSP client / facility.",
      "Full applicant onboarding workflow is required.",
    ],
  },
};

/** Jobs that need onboarding workflow assignment before publish/apply. */
export function jobRequiresWorkflow(
  job: Pick<JobRequisitionInput, "sourceType" | "placementType">
): boolean {
  if (job.sourceType === "Internal") return true;
  if (job.sourceType === "MSP") return true;
  return false;
}

export function isMspRecruitAndRelease(
  job: Pick<JobRequisitionInput, "sourceType" | "placementType">
): boolean {
  return job.sourceType === "MSP" && job.placementType === "Recruit_and_Release";
}

export function isMspRecruitAndEor(
  job: Pick<JobRequisitionInput, "sourceType" | "placementType">
): boolean {
  return job.sourceType === "MSP" && job.placementType === "Recruit_and_EOR";
}

export function resolvePlacementTypeForSource(
  sourceType: SourceType,
  mspPlacementType?: PlacementType | null
): PlacementType {
  if (sourceType === "Internal") return "Internal";
  if (mspPlacementType === "Recruit_and_EOR") return "Recruit_and_EOR";
  return "Recruit_and_Release";
}

export function deriveEorType(
  job: Pick<JobRequisitionInput, "sourceType" | "placementType" | "eorType">
): "Tenant" | "MSP" | null {
  if (job.eorType === "Tenant" || job.eorType === "MSP") return job.eorType;
  if (job.sourceType === "Internal") return "Tenant";
  if (job.placementType === "Recruit_and_EOR") return "Tenant";
  if (job.placementType === "Recruit_and_Release") return "MSP";
  return null;
}

export function defaultEmploymentTypeForJob(
  job: Pick<JobRequisitionInput, "sourceType" | "placementType" | "employmentType">
): EmploymentType {
  if (job.sourceType === "MSP" && job.placementType === "Recruit_and_Release") {
    return "Contract";
  }
  if (job.employmentType === "W2" || job.employmentType === "1099" || job.employmentType === "Contract") {
    return job.employmentType;
  }
  /** Leave unset until the user selects (form may use empty string). */
  return (job.employmentType || "") as EmploymentType;
}

export function placementTypeFromApiRow(
  sourceType: SourceType,
  rawPlacementType: unknown,
  employmentType?: unknown
): PlacementType {
  const placement = String(rawPlacementType ?? "").trim();
  if (placement === "Recruit_and_EOR") return "Recruit_and_EOR";
  if (placement === "Recruit_and_Release") return "Recruit_and_Release";
  if (placement === "Internal") return "Internal";
  if (sourceType === "Internal") return "Internal";
  const employment = String(employmentType ?? "").trim();
  if (employment === "W2" || employment === "1099") return "Recruit_and_EOR";
  return "Recruit_and_Release";
}
