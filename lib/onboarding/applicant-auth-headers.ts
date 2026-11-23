import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser";
import {
  DRAFT_PREVIEW_APPLICANT_ID,
  isOnboardingDraftPreview,
} from "@/lib/onboarding/is-draft-preview";
import { setScopedApplicantId } from "@/lib/tenant/scoped-storage";

/** Bearer token for the isolated applicant session, plus a refreshed access cookie. */
export async function applicantAuthHeaders(extra?: Record<string, string>): Promise<{
  headers: Record<string, string>;
  applicantId: string | null;
}> {
  const headers: Record<string, string> = { ...extra };

  // Workflow Preview / Test mode must never inherit a live applicant auth user.
  // Otherwise Save & continue overwrites a real worker (BUG-130).
  if (typeof window !== "undefined" && isOnboardingDraftPreview(window.location.search)) {
    setScopedApplicantId(DRAFT_PREVIEW_APPLICANT_ID);
    return { headers, applicantId: DRAFT_PREVIEW_APPLICANT_ID };
  }

  let applicantId: string | null = null;
  try {
    const supabase = getApplicantSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const userId = data.session?.user?.id;
    if (userId) {
      applicantId = userId;
      setScopedApplicantId(userId);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      await fetch("/api/onboarding/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  } catch {
    /* The request can still proceed with the httpOnly cookie when it is present. */
  }
  return { headers, applicantId };
}
