import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeApplicantEmail,
  pickDeliverableEmailFromRecord,
  pickDeliverableEmailFromSources,
  resolveEmailFromResumeRow,
} from "@/lib/onboarding/resolve-applicant-signing-email";
import {
  buildFirmaSigningAddressPrefill,
  formatFirmaSigningFullAddress,
  type FirmaSigningAddressPrefill,
} from "@/lib/onboarding/firma-signing-prefill";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";
import { isDeliverableApplicantEmail } from "@/lib/onboardingStep1Validation";

export type ApplicantSigningProfile = {
  firstName: string;
  lastName: string | null;
  email: string;
  streetAddress: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  fullAddress: string | null;
};

async function loadLatestResumeRow(
  supabase: SupabaseClient,
  workerId: string
): Promise<{ parsed_data?: Record<string, unknown> | null; extracted_text?: string | null } | null> {
  const { data, error } = await supabase
    .from("worker_resumes")
    .select("parsed_data, extracted_text")
    .eq("worker_id", workerId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as {
    parsed_data?: Record<string, unknown> | null;
    extracted_text?: string | null;
  } | null) ?? null;
}

function addressFromWorkerRow(row: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
} | null): FirmaSigningAddressPrefill {
  return buildFirmaSigningAddressPrefill({
    address1: row?.address1,
    address2: row?.address2,
    city: row?.city,
    state: row?.state,
    zip: row?.zip,
  });
}

function addressFromResume(
  resume: { parsed_data?: Record<string, unknown> | null } | null
): FirmaSigningAddressPrefill {
  if (!resume?.parsed_data) {
    return {
      streetAddress: null,
      city: null,
      stateProvince: null,
      postalCode: null,
      fullAddress: null,
    };
  }
  const parsed = normalizeParsedResume(resume.parsed_data);
  return buildFirmaSigningAddressPrefill({
    address1: parsed.address1,
    address2: parsed.address2,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
  });
}

function mergeAddress(
  primary: FirmaSigningAddressPrefill,
  fallback: FirmaSigningAddressPrefill
): FirmaSigningAddressPrefill {
  const merged = {
    streetAddress: primary.streetAddress ?? fallback.streetAddress,
    city: primary.city ?? fallback.city,
    stateProvince: primary.stateProvince ?? fallback.stateProvince,
    postalCode: primary.postalCode ?? fallback.postalCode,
  };
  return {
    ...merged,
    fullAddress: formatFirmaSigningFullAddress(merged),
  };
}

/**
 * Resolves a deliverable email (and address) for Firma signing from the tenant worker row,
 * resume parse data, and Supabase Auth when the worker profile has not been synced yet.
 */
export async function resolveApplicantSigningProfile(
  supabase: SupabaseClient,
  workerId: string,
  applicantUserId: string
): Promise<ApplicantSigningProfile | null> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select("first_name, last_name, email, address1, address2, city, state, zip")
    .eq("id", workerId)
    .maybeSingle();

  if (error) throw error;

  const row = worker as {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;

  let email =
    pickDeliverableEmailFromRecord(row as Record<string, unknown> | null) ??
    pickDeliverableEmailFromSources(row?.email) ??
    "";

  let resumeRow: Awaited<ReturnType<typeof loadLatestResumeRow>> | null = null;
  const loadResume = async () => {
    if (resumeRow !== null) return resumeRow;
    resumeRow = await loadLatestResumeRow(supabase, workerId);
    return resumeRow;
  };

  if (!isDeliverableApplicantEmail(email)) {
    const resumeEmail = resolveEmailFromResumeRow(await loadResume());
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

  let address = addressFromWorkerRow(row);
  if (!address.streetAddress || !address.city || !address.stateProvince || !address.postalCode) {
    try {
      address = mergeAddress(address, addressFromResume(await loadResume()));
    } catch {
      // Soft-fail: email is enough to create a signing session.
    }
  }

  return {
    firstName: row?.first_name?.trim() || "Applicant",
    lastName: row?.last_name?.trim() || null,
    email: normalizeApplicantEmail(email),
    streetAddress: address.streetAddress,
    city: address.city,
    stateProvince: address.stateProvince,
    postalCode: address.postalCode,
    fullAddress: address.fullAddress,
  };
}
