/** Persisted when the system advances past a placeholder with no applicant screen. */
export const NON_NAVIGABLE_SYSTEM_COMPLETE_DATA = {
  system_completed: true,
  reason: "non_navigable_placeholder",
} as const;

/** Builder library id for the Parameterized Job Application placeholder step. */
export const PARAMETERIZED_JOB_APPLICATION_WORKFLOW_STEP_ID =
  "parameterized-job-application" as const;
