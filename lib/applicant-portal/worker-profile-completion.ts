export type WorkerProfileCompletionWorker = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  positions: string[] | null;
};

export type WorkerProfileCompletionInput = {
  worker: WorkerProfileCompletionWorker;
  hasProfilePhoto: boolean;
  requiredDocumentCount: number;
  submittedRequiredDocumentIds: string[];
  portalDocumentCount: number;
  licenseCount: number;
  completedAssessmentCount: number;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function personalCompletionRatio(worker: WorkerProfileCompletionWorker, hasProfilePhoto: boolean): number {
  const checks = [
    hasProfilePhoto,
    hasText(worker.first_name) && hasText(worker.last_name),
    hasText(worker.email),
    hasText(worker.phone),
    hasText(worker.address1),
    hasText(worker.city) && hasText(worker.state),
    hasText(worker.zip),
  ];
  const filled = checks.filter(Boolean).length;
  return filled / checks.length;
}

function documentsCompletionRatio(
  requiredDocumentCount: number,
  submittedRequiredDocumentIds: string[],
  portalDocumentCount: number
): number {
  if (requiredDocumentCount > 0) {
    const uniqueSubmitted = new Set(
      submittedRequiredDocumentIds.map((id) => id.trim()).filter(Boolean)
    ).size;
    return Math.min(1, uniqueSubmitted / requiredDocumentCount);
  }

  return portalDocumentCount > 0 ? 1 : 0;
}

function skillsCompletionRatio(
  worker: WorkerProfileCompletionWorker,
  licenseCount: number,
  completedAssessmentCount: number
): number {
  const hasPositions = (worker.positions ?? []).some((item) => item.trim().length > 0);
  return licenseCount > 0 || completedAssessmentCount > 0 || hasPositions ? 1 : 0;
}

/** Worker portal profile completion — personal info, documents, and skills. */
export function computeWorkerProfileCompletionPercent(input: WorkerProfileCompletionInput): number {
  const personal = personalCompletionRatio(input.worker, input.hasProfilePhoto);
  const documents = documentsCompletionRatio(
    input.requiredDocumentCount,
    input.submittedRequiredDocumentIds,
    input.portalDocumentCount
  );
  const skills = skillsCompletionRatio(
    input.worker,
    input.licenseCount,
    input.completedAssessmentCount
  );

  const weighted = personal * 0.5 + documents * 0.3 + skills * 0.2;
  return Math.min(100, Math.max(0, Math.round(weighted * 100)));
}
