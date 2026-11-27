"use client";

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { isOnboardingDraftPreview } from "@/lib/onboarding/is-draft-preview";
import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser";
import { clearScopedApplicantId } from "@/lib/tenant/scoped-storage";
import { applicationPath } from "@/lib/tenant/with-tenant";

const ONBOARDING_LOCAL_KEYS = [
  "applicantId",
  "parsedResume",
  "referenceData",
  "referenceDataDraft",
  "referencesCount",
  "step5Completed",
  "step1ReviewCompleted",
  "resumeStoragePath",
  "resumeName",
  "applicationJobToken",
] as const;

/**
 * Clears the anonymous applicant session and restarts public apply for the current job.
 * Preserves tenant and job_token; drops applicationId so continue links still work on reload.
 */
export async function restartPublicApplyAsSomeoneElse(): Promise<void> {
  if (typeof window === "undefined") return;
  if (isOnboardingDraftPreview(window.location.search)) return;

  await getApplicantSupabaseClient().auth.signOut({ scope: "local" }).catch(() => undefined);
  clearScopedApplicantId();
  try {
    for (const key of ONBOARDING_LOCAL_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore storage errors */
  }

  const params = new URLSearchParams(window.location.search);
  params.delete("applicationId");
  const tenant = params.get("tenant")?.trim().toLowerCase() || null;
  const jobToken = params.get("job_token")?.trim() || params.get("jobToken")?.trim() || "";
  const restartParams = new URLSearchParams();
  if (jobToken) restartParams.set("job_token", jobToken);
  const href = applicationPath(APPLICATION_ROUTES.addResume, tenant);
  const query = restartParams.toString();
  window.location.assign(query ? `${href}${href.includes("?") ? "&" : "?"}${query}` : href);
}