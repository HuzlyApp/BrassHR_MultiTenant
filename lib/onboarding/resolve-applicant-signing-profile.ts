import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";

export type ApplicantSigningProfile = {
  firstName: string;
  lastName: string | null;
  email: string;
};

/**
 * Resolves a deliverable email for Firma signing from the tenant worker row,
 * falling back to Supabase Auth when the worker profile has not been synced yet.
 */
export async function resolveApplicantSigningProfile(
  supabase: SupabaseClient,
  workerId: string,
  applicantUserId: string
): Promise<ApplicantSigningProfile | null> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select("first_name, last_name, email")
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;

  const row = worker as {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;

  let email = row?.email?.trim() || "";

  if (!isDeliverableApplicantEmail(email)) {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(applicantUserId);
    if (!authErr) {
      const authEmail = authData?.user?.email?.trim() || "";
      if (isDeliverableApplicantEmail(authEmail)) {
        email = authEmail;
        if (row && !row.email?.trim()) {
          await supabase
            .from("worker")
            .update({ email: authEmail.toLowerCase(), updated_at: new Date().toISOString() })
            .eq("id", workerId);
        }
      }
    }
  }

  if (!isDeliverableApplicantEmail(email)) return null;

  return {
    firstName: row?.first_name?.trim() || "Applicant",
    lastName: row?.last_name?.trim() || null,
    email: email.toLowerCase(),
  };
}
