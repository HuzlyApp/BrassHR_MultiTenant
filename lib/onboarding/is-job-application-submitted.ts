/** True when the applicant has already submitted this job application. */
export function isJobApplicationAlreadySubmitted(input: {
  submitted_at?: string | null;
  submittedAt?: string | null;
  id?: unknown;
  status?: unknown;
  applicant_workflow_instance_id?: unknown;
}): boolean {
  const submittedAt = input.submitted_at ?? input.submittedAt;
  return Boolean(typeof submittedAt === "string" && submittedAt.trim());
}
