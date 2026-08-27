import { firstOnboardingStepRoute } from "@/lib/onboarding/tenant-step-navigation";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

/** Query flag for admin Test workflow / draft preview sessions. */
export const WORKFLOW_TEST_PREVIEW_PARAM = "preview";
export const WORKFLOW_TEST_PREVIEW_VALUE = "draft";

/** Synthetic applicant id already used by draft preview — reused for Test workflow. */
export { DRAFT_PREVIEW_APPLICANT_ID as WORKFLOW_TEST_APPLICANT_ID } from "@/lib/onboarding/is-draft-preview";

/**
 * True when the current applicant session is an admin Test workflow / draft preview
 * (not a live candidate application).
 */
export function isWorkflowTestSession(search?: string | null): boolean {
  const query =
    typeof search === "string" && search.trim()
      ? search.startsWith("?")
        ? search.slice(1)
        : search
      : typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : "";
  const params = new URLSearchParams(query);
  const preview = params.get(WORKFLOW_TEST_PREVIEW_PARAM)?.trim().toLowerCase();
  const mode = params.get("mode")?.trim().toLowerCase();
  return preview === WORKFLOW_TEST_PREVIEW_VALUE || mode === "test";
}

/**
 * Builds the applicant-facing Test workflow URL from the current builder draft config.
 * Never attaches a production job_token — Test workflow is workflow-scoped, not job-scoped.
 */
export function buildWorkflowTestUrl(
  config: TenantOnboardingConfig,
  tenantSlug: string | null | undefined
): string {
  const route = firstOnboardingStepRoute(config, tenantSlug);
  const [pathname, existingQuery = ""] = route.split("?");
  const params = new URLSearchParams(existingQuery);
  params.set(WORKFLOW_TEST_PREVIEW_PARAM, WORKFLOW_TEST_PREVIEW_VALUE);
  params.delete("job_token");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Strip live-application job tokens from a path when entering or staying in test mode. */
export function stripJobTokenForWorkflowTest(path: string): string {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("job_token");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Live applicants who open add-resume without a job_token should be sent to the
 * public jobs board when the tenant has open positions. Test workflow / draft
 * preview is workflow-scoped and must never take that path.
 */
export function shouldGateResumeEntryByJobBoard(opts: {
  search?: string | null;
  jobToken?: string | null;
}): boolean {
  if (isWorkflowTestSession(opts.search)) return false;
  return !opts.jobToken?.trim();
}
