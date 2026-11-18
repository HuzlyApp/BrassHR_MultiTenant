import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser";
import { setScopedApplicantId } from "@/lib/tenant/scoped-storage";

/** Bearer token for the isolated applicant session, plus a refreshed access cookie. */
export async function applicantAuthHeaders(extra?: Record<string, string>): Promise<{
  headers: Record<string, string>;
  applicantId: string | null;
}> {
  const headers: Record<string, string> = { ...extra };
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
