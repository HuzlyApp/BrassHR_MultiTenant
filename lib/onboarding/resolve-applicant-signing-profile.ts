import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeApplicantEmail,
  pickDeliverableEmailFromRecord,
  pickDeliverableEmailFromSources,
  resolveEmailFromResumeRow,
} from "@/lib/onboarding/resolve-applicant-signing-email";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";

export type ApplicantSigningProfile = {
  firstName: string;
  lastName: string | null;
  email: string;
};

async function loadResumeEmail(
  supabase: SupabaseClient,
  workerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("worker_resumes")
    .select("parsed_data, extracted_text")
    .eq("worker_id", workerId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return resolveEmailFromResumeRow(
    data as { parsed_data?: Record<string, unknown> | null; extracted_text?: string | null } | null
  );
}

/**
 * Resolves a deliverable email for Firma signing from the tenant worker row,
 * resume parse data, and Supabase Auth when the worker profile has not been synced yet.
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

  let email =
    pickDeliverableEmailFromRecord(row as Record<string, unknown> | null) ??
    pickDeliverableEmailFromSources(row?.email) ??
    "";

  if (!isDeliverableApplicantEmail(email)) {
    const resumeEmail = await loadResumeEmail(supabase, workerId);
    if (resumeEmail) email = resumeEmail;
  }

  if (!isDeliverableApplicantEmail(email)) {
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(applicantUserId);
    if (!authErr) {
      const authEmail = normalizeApplicantEmail(authData?.user?.email);
      if (isDeliverableApplicantEmail(authEmail)) {
        email = authEmail;
        if (row && !pickDeliverableEmailFromSources(row.email)) {
          await supabase
            .from("worker")
            .update({ email: authEmail, updated_at: new Date().toISOString() })
            .eq("id", workerId);
        }
      }
    }
  }

  if (!isDeliverableApplicantEmail(email)) return null;

  return {
    firstName: row?.first_name?.trim() || "Applicant",
    lastName: row?.last_name?.trim() || null,
    email: normalizeApplicantEmail(email),
  };
}
