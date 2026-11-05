import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDataSource } from "@/lib/recruiter-templates/constants";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";

export type FirmaSigningAddressPrefill = {
  streetAddress: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  /** Single-line address for template fields mapped to candidate_address. */
  fullAddress: string | null;
};

export type FirmaSigningPrefillValues = FirmaSigningAddressPrefill & {
  jobTitle: string | null;
};

export type FirmaSigningTemplateFieldMapping = {
  variable_name: string;
  app_data_source: AppDataSource | string;
  firma_field_id?: string | null;
};

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
}

export function formatFirmaSigningFullAddress(parts: {
  streetAddress?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
}): string | null {
  const street = clean(parts.streetAddress);
  const city = clean(parts.city);
  const state = clean(parts.stateProvince);
  const postal = clean(parts.postalCode);

  const cityState = [city, state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, postal].filter(Boolean).join(" ").trim();
  const full = [street, cityStateZip].filter(Boolean).join(", ").trim();
  return full || null;
}

export function buildFirmaSigningAddressPrefill(input: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): FirmaSigningAddressPrefill {
  const line1 = clean(input.address1);
  const line2 = clean(input.address2);
  const streetAddress = [line1, line2].filter(Boolean).join(", ") || null;
  const city = clean(input.city);
  const stateProvince = clean(input.state);
  const postalCode = clean(input.zip);
  return {
    streetAddress,
    city,
    stateProvince,
    postalCode,
    fullAddress: formatFirmaSigningFullAddress({
      streetAddress,
      city,
      stateProvince,
      postalCode,
    }),
  };
}

function addressFromParsedResume(parsedData: unknown): FirmaSigningAddressPrefill | null {
  const parsed = normalizeParsedResume(parsedData);
  const built = buildFirmaSigningAddressPrefill({
    address1: parsed.address1,
    address2: parsed.address2,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
  });
  if (!built.streetAddress && !built.city && !built.stateProvince && !built.postalCode) {
    return null;
  }
  return built;
}

function preferAddress(
  primary: FirmaSigningAddressPrefill | null,
  fallback: FirmaSigningAddressPrefill | null
): FirmaSigningAddressPrefill {
  if (!primary) {
    return (
      fallback ?? {
        streetAddress: null,
        city: null,
        stateProvince: null,
        postalCode: null,
        fullAddress: null,
      }
    );
  }
  if (!fallback) return primary;
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
 * Loads candidate address from the worker row, falling back to the latest parsed resume.
 */
export async function resolveFirmaSigningAddressPrefill(
  supabase: SupabaseClient,
  workerId: string,
  seed?: Partial<FirmaSigningAddressPrefill> | null
): Promise<FirmaSigningAddressPrefill> {
  const seeded = seed
    ? {
        streetAddress: clean(seed.streetAddress),
        city: clean(seed.city),
        stateProvince: clean(seed.stateProvince),
        postalCode: clean(seed.postalCode),
        fullAddress:
          clean(seed.fullAddress) ??
          formatFirmaSigningFullAddress({
            streetAddress: seed.streetAddress,
            city: seed.city,
            stateProvince: seed.stateProvince,
            postalCode: seed.postalCode,
          }),
      }
    : null;

  let fromWorker: FirmaSigningAddressPrefill | null = null;
  try {
    const { data, error } = await supabase
      .from("worker")
      .select("address1, address2, city, state, zip")
      .eq("id", workerId)
      .maybeSingle();
    if (!error && data) {
      fromWorker = buildFirmaSigningAddressPrefill({
        address1: (data as { address1?: string | null }).address1,
        address2: (data as { address2?: string | null }).address2,
        city: (data as { city?: string | null }).city,
        state: (data as { state?: string | null }).state,
        zip: (data as { zip?: string | null }).zip,
      });
    }
  } catch {
    // Soft-fail: signing can proceed without address prefill.
  }

  let fromResume: FirmaSigningAddressPrefill | null = null;
  const needsResumeFallback =
    !preferAddress(seeded, fromWorker).streetAddress ||
    !preferAddress(seeded, fromWorker).city;
  if (needsResumeFallback) {
    try {
      const { data, error } = await supabase
        .from("worker_resumes")
        .select("parsed_data")
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        fromResume = addressFromParsedResume(
          (data as { parsed_data?: unknown }).parsed_data
        );
      }
    } catch {
      // Soft-fail.
    }
  }

  return preferAddress(preferAddress(seeded, fromWorker), fromResume);
}

/**
 * Resolves job title from the linked job application → job requisition.
 */
export async function resolveFirmaSigningJobTitle(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string | null | undefined,
  seedJobTitle?: string | null
): Promise<string | null> {
  const seeded = clean(seedJobTitle);
  if (seeded) return seeded;
  const appId = applicationId?.trim() || null;
  if (!appId) return null;

  try {
    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("job_requisition_id")
      .eq("id", appId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (appError || !application) return null;

    const jobId = clean((application as { job_requisition_id?: string | null }).job_requisition_id);
    if (!jobId) return null;

    const { data: job, error: jobError } = await supabase
      .from("job_requisitions")
      .select("public_title, source_job_title")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (jobError || !job) return null;

    const row = job as { public_title?: string | null; source_job_title?: string | null };
    return clean(row.public_title) ?? clean(row.source_job_title);
  } catch {
    return null;
  }
}

export async function resolveFirmaSigningPrefillValues(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    workerId: string;
    applicationId?: string | null;
    address?: Partial<FirmaSigningAddressPrefill> | null;
    jobTitle?: string | null;
  }
): Promise<FirmaSigningPrefillValues> {
  const [address, jobTitle] = await Promise.all([
    resolveFirmaSigningAddressPrefill(supabase, input.workerId, input.address),
    resolveFirmaSigningJobTitle(
      supabase,
      input.tenantId,
      input.applicationId,
      input.jobTitle
    ),
  ]);
  return { ...address, jobTitle };
}

export function buildFirmaRecipientPrefillPayload(
  prefill: FirmaSigningPrefillValues
): Record<string, unknown> {
  const customFields: Record<string, string> = {};
  if (prefill.jobTitle) {
    customFields.job_title = prefill.jobTitle;
    customFields.position_title = prefill.jobTitle;
  }
  if (prefill.fullAddress) {
    customFields.candidate_address = prefill.fullAddress;
  }

  return {
    ...(prefill.jobTitle ? { title: prefill.jobTitle } : {}),
    ...(prefill.streetAddress ? { street_address: prefill.streetAddress } : {}),
    ...(prefill.city ? { city: prefill.city } : {}),
    ...(prefill.stateProvince ? { state_province: prefill.stateProvince } : {}),
    ...(prefill.postalCode ? { postal_code: prefill.postalCode } : {}),
    ...(Object.keys(customFields).length > 0 ? { custom_fields: customFields } : {}),
  };
}

function valueForAppDataSource(
  source: string,
  input: {
    firstName: string;
    lastName?: string | null;
    email: string;
    prefill: FirmaSigningPrefillValues;
  }
): string | null {
  switch (source) {
    case "candidate_name": {
      const full = [input.firstName, input.lastName?.trim()].filter(Boolean).join(" ").trim();
      return full || null;
    }
    case "candidate_email":
      return clean(input.email);
    case "candidate_address":
      return prefillFullAddress(input.prefill);
    case "position_title":
      return clean(input.prefill.jobTitle);
    default:
      return null;
  }
}

function prefillFullAddress(prefill: FirmaSigningPrefillValues): string | null {
  return (
    clean(prefill.fullAddress) ??
    formatFirmaSigningFullAddress({
      streetAddress: prefill.streetAddress,
      city: prefill.city,
      stateProvince: prefill.stateProvince,
      postalCode: prefill.postalCode,
    })
  );
}

/**
 * Builds template field overrides so mapped text fields show DB values even when
 * the Firma template field was not configured with format_rules.prefilledData.
 */
export function buildFirmaFieldPrefillOverrides(
  fields: FirmaSigningTemplateFieldMapping[],
  input: {
    firstName: string;
    lastName?: string | null;
    email: string;
    prefill: FirmaSigningPrefillValues;
  }
): Array<Record<string, unknown>> {
  const overrides: Array<Record<string, unknown>> = [];
  for (const field of fields) {
    const variableName = clean(field.variable_name);
    if (!variableName) continue;
    const value = valueForAppDataSource(String(field.app_data_source ?? ""), input);
    if (!value) continue;
    overrides.push({
      ...(field.firma_field_id ? { template_field_id: field.firma_field_id } : {}),
      variable_name: variableName,
      read_only: true,
      read_only_value: value,
    });
  }
  return overrides;
}

export async function loadFirmaSigningTemplateFieldMappings(
  supabase: SupabaseClient,
  recruiterTemplateId: string
): Promise<FirmaSigningTemplateFieldMapping[]> {
  try {
    const { data, error } = await supabase
      .from("recruiter_template_fields")
      .select("variable_name, app_data_source, firma_field_id")
      .eq("template_id", recruiterTemplateId)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return (data as FirmaSigningTemplateFieldMapping[]).filter((row) =>
      Boolean(clean(row.variable_name))
    );
  } catch {
    return [];
  }
}
