import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDataSource } from "@/lib/recruiter-templates/constants";
import { normalizeParsedResume } from "@/lib/resumeParseQuality";

export type FirmaSigningAddressPrefill = {
  streetAddress: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  /** Single-line address for template fields mapped to candidate_address. */
  fullAddress: string | null;
};

export type FirmaSigningEmploymentPrefill = {
  jobTitle: string | null;
  employmentType: string | null;
  startDate: string | null;
  payRate: string | null;
  payFrequency: string | null;
  managerName: string | null;
};

export type FirmaSigningPersonalPrefill = {
  phone: string | null;
  dateOfBirth: string | null;
  /** Last 4 only — full SSN is not stored in BrassHR. */
  ssnLastFour: string | null;
};

export type FirmaSigningPrefillValues = FirmaSigningAddressPrefill &
  FirmaSigningEmploymentPrefill &
  FirmaSigningPersonalPrefill;

export type FirmaSigningTemplateFieldMapping = {
  variable_name: string;
  app_data_source: AppDataSource | string;
  firma_field_id?: string | null;
};

export const EMPTY_FIRMA_SIGNING_PREFILL: FirmaSigningPrefillValues = {
  streetAddress: null,
  addressLine2: null,
  city: null,
  stateProvince: null,
  postalCode: null,
  country: null,
  fullAddress: null,
  jobTitle: null,
  employmentType: null,
  startDate: null,
  payRate: null,
  payFrequency: null,
  managerName: null,
  phone: null,
  dateOfBirth: null,
  ssnLastFour: null,
};

function clean(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
}

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function asAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function formatFirmaSigningPayRate(job: {
  pay_rate?: unknown;
  pay_rate_min?: unknown;
  pay_rate_max?: unknown;
  hourly_rate?: unknown;
}): string | null {
  const min = asAmount(job.pay_rate_min);
  const max = asAmount(job.pay_rate_max);
  const single = asAmount(job.pay_rate) ?? asAmount(job.hourly_rate);
  if (min && max && min !== max) return `${money(min)} – ${money(max)}`;
  if (min ?? max ?? single) return money((min ?? max ?? single) as number);
  return null;
}

export function formatFirmaSigningPayFrequency(job: {
  pay_rate_period?: unknown;
  rate_unit?: unknown;
  compensation_type?: unknown;
}): string | null {
  const raw = (
    clean(job.pay_rate_period) ??
    clean(job.rate_unit) ??
    clean(job.compensation_type) ??
    ""
  ).toLowerCase();
  if (!raw) return null;
  if (raw.includes("hour")) return "Hourly";
  if (raw.includes("week") && raw.includes("bi")) return "Bi-weekly";
  if (raw.includes("week")) return "Weekly";
  if (raw.includes("month")) return "Monthly";
  if (raw.includes("year") || raw.includes("annual") || raw.includes("salary")) return "Annually";
  if (raw.includes("day")) return "Daily";
  return clean(job.pay_rate_period) ?? clean(job.rate_unit) ?? clean(job.compensation_type);
}

export function formatFirmaSigningFullAddress(parts: {
  streetAddress?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): string | null {
  const street = [clean(parts.streetAddress), clean(parts.addressLine2)].filter(Boolean).join(", ");
  const city = clean(parts.city);
  const state = clean(parts.stateProvince);
  const postal = clean(parts.postalCode);
  const country = clean(parts.country);

  const cityState = [city, state].filter(Boolean).join(", ");
  const cityStateZip = [cityState, postal].filter(Boolean).join(" ").trim();
  const full = [street, cityStateZip, country].filter(Boolean).join(", ").trim();
  return full || null;
}

export function buildFirmaSigningAddressPrefill(input: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}): FirmaSigningAddressPrefill {
  const streetAddress = clean(input.address1);
  const addressLine2 = clean(input.address2);
  const city = clean(input.city);
  const stateProvince = clean(input.state);
  const postalCode = clean(input.zip);
  const country = clean(input.country);
  return {
    streetAddress,
    addressLine2,
    city,
    stateProvince,
    postalCode,
    country,
    fullAddress: formatFirmaSigningFullAddress({
      streetAddress,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
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
        addressLine2: null,
        city: null,
        stateProvince: null,
        postalCode: null,
        country: null,
        fullAddress: null,
      }
    );
  }
  if (!fallback) return primary;
  const merged = {
    streetAddress: primary.streetAddress ?? fallback.streetAddress,
    addressLine2: primary.addressLine2 ?? fallback.addressLine2,
    city: primary.city ?? fallback.city,
    stateProvince: primary.stateProvince ?? fallback.stateProvince,
    postalCode: primary.postalCode ?? fallback.postalCode,
    country: primary.country ?? fallback.country,
  };
  return {
    ...merged,
    fullAddress: formatFirmaSigningFullAddress(merged),
  };
}

type WorkerPrefillRow = {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  ssn_last_four?: string | null;
  hourly_rate?: number | string | null;
  manager_name?: string | null;
  reports_to?: string | null;
};

async function loadWorkerPrefillRow(
  supabase: SupabaseClient,
  workerId: string
): Promise<WorkerPrefillRow | null> {
  try {
    const { data, error } = await supabase
      .from("worker")
      .select(
        "address1, address2, city, state, zip, phone, date_of_birth, ssn_last_four, hourly_rate, manager_name, reports_to"
      )
      .eq("id", workerId)
      .maybeSingle();
    if (error || !data) return null;
    return data as WorkerPrefillRow;
  } catch {
    return null;
  }
}

/**
 * Loads candidate address from the worker row, falling back to the latest parsed resume.
 * Country comes from applicant_profiles when available (worker has no country column).
 */
export async function resolveFirmaSigningAddressPrefill(
  supabase: SupabaseClient,
  workerId: string,
  seed?: Partial<FirmaSigningAddressPrefill> | null,
  options?: { country?: string | null; workerRow?: WorkerPrefillRow | null }
): Promise<FirmaSigningAddressPrefill> {
  const seeded = seed
    ? {
        streetAddress: clean(seed.streetAddress),
        addressLine2: clean(seed.addressLine2),
        city: clean(seed.city),
        stateProvince: clean(seed.stateProvince),
        postalCode: clean(seed.postalCode),
        country: clean(seed.country) ?? clean(options?.country),
        fullAddress:
          clean(seed.fullAddress) ??
          formatFirmaSigningFullAddress({
            streetAddress: seed.streetAddress,
            addressLine2: seed.addressLine2,
            city: seed.city,
            stateProvince: seed.stateProvince,
            postalCode: seed.postalCode,
            country: seed.country ?? options?.country,
          }),
      }
    : null;

  const workerRow = options?.workerRow ?? (await loadWorkerPrefillRow(supabase, workerId));
  const fromWorker = workerRow
    ? buildFirmaSigningAddressPrefill({
        address1: workerRow.address1,
        address2: workerRow.address2,
        city: workerRow.city,
        state: workerRow.state,
        zip: workerRow.zip,
        country: options?.country,
      })
    : null;

  let fromResume: FirmaSigningAddressPrefill | null = null;
  const mergedSeedWorker = preferAddress(seeded, fromWorker);
  const needsResumeFallback =
    !mergedSeedWorker.streetAddress || !mergedSeedWorker.city || !mergedSeedWorker.stateProvince;
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
        fromResume = addressFromParsedResume((data as { parsed_data?: unknown }).parsed_data);
      }
    } catch {
      // Soft-fail.
    }
  }

  const resolved = preferAddress(mergedSeedWorker, fromResume);
  if (!resolved.country && clean(options?.country)) {
    resolved.country = clean(options?.country);
    resolved.fullAddress = formatFirmaSigningFullAddress(resolved);
  }
  // Step 1 / US hiring flow defaults country when other address parts exist.
  if (!resolved.country && (resolved.streetAddress || resolved.city || resolved.postalCode)) {
    resolved.country = "US";
    resolved.fullAddress = formatFirmaSigningFullAddress(resolved);
  }
  return resolved;
}

export async function resolveFirmaSigningJobContext(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string | null | undefined,
  seed?: Partial<FirmaSigningEmploymentPrefill> | null
): Promise<FirmaSigningEmploymentPrefill & { applicantProfileCountry: string | null }> {
  const seeded: FirmaSigningEmploymentPrefill = {
    jobTitle: clean(seed?.jobTitle),
    employmentType: clean(seed?.employmentType),
    startDate: clean(seed?.startDate),
    payRate: clean(seed?.payRate),
    payFrequency: clean(seed?.payFrequency),
    managerName: clean(seed?.managerName),
  };

  const appId = applicationId?.trim() || null;
  if (!appId) {
    return { ...seeded, applicantProfileCountry: null };
  }

  try {
    const { data: application, error: appError } = await supabase
      .from("job_applications")
      .select("job_requisition_id, applicant_profile_id")
      .eq("id", appId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (appError || !application) {
      return { ...seeded, applicantProfileCountry: null };
    }

    const appRow = application as {
      job_requisition_id?: string | null;
      applicant_profile_id?: string | null;
    };

    let applicantProfileCountry: string | null = null;
    const profileId = clean(appRow.applicant_profile_id);
    if (profileId) {
      try {
        const { data: profile } = await supabase
          .from("applicant_profiles")
          .select("country")
          .eq("id", profileId)
          .maybeSingle();
        applicantProfileCountry = clean((profile as { country?: string | null } | null)?.country);
      } catch {
        applicantProfileCountry = null;
      }
    }

    const jobId = clean(appRow.job_requisition_id);
    if (!jobId) {
      return { ...seeded, applicantProfileCountry };
    }

    const { data: job, error: jobError } = await supabase
      .from("job_requisitions")
      .select(
        "public_title, source_job_title, employment_type, target_start_date, pay_rate, pay_rate_min, pay_rate_max, pay_rate_period, rate_unit, compensation_type"
      )
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (jobError || !job) {
      return { ...seeded, applicantProfileCountry };
    }

    const row = job as Record<string, unknown>;
    const start = clean(row.target_start_date);
    return {
      jobTitle:
        seeded.jobTitle ?? clean(row.public_title) ?? clean(row.source_job_title),
      employmentType: seeded.employmentType ?? clean(row.employment_type),
      startDate: seeded.startDate ?? (start ? start.slice(0, 10) : null),
      payRate: seeded.payRate ?? formatFirmaSigningPayRate(row),
      payFrequency: seeded.payFrequency ?? formatFirmaSigningPayFrequency(row),
      managerName: seeded.managerName,
      applicantProfileCountry,
    };
  } catch {
    return { ...seeded, applicantProfileCountry: null };
  }
}

/** @deprecated Prefer resolveFirmaSigningJobContext — kept for existing tests. */
export async function resolveFirmaSigningJobTitle(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string | null | undefined,
  seedJobTitle?: string | null
): Promise<string | null> {
  const ctx = await resolveFirmaSigningJobContext(supabase, tenantId, applicationId, {
    jobTitle: seedJobTitle,
  });
  return ctx.jobTitle;
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
  const workerRow = await loadWorkerPrefillRow(supabase, input.workerId);
  const jobContext = await resolveFirmaSigningJobContext(
    supabase,
    input.tenantId,
    input.applicationId,
    { jobTitle: input.jobTitle }
  );

  const address = await resolveFirmaSigningAddressPrefill(
    supabase,
    input.workerId,
    input.address,
    {
      country: jobContext.applicantProfileCountry ?? input.address?.country,
      workerRow,
    }
  );

  const personal: FirmaSigningPersonalPrefill = {
    phone: clean(workerRow?.phone),
    dateOfBirth: clean(workerRow?.date_of_birth)
      ? String(workerRow?.date_of_birth).slice(0, 10)
      : null,
    ssnLastFour: clean(workerRow?.ssn_last_four),
  };

  const managerName =
    jobContext.managerName ??
    clean(workerRow?.reports_to) ??
    clean(workerRow?.manager_name);

  const payRate =
    jobContext.payRate ??
    (workerRow?.hourly_rate != null ? formatFirmaSigningPayRate({ hourly_rate: workerRow.hourly_rate }) : null);

  return {
    ...address,
    jobTitle: jobContext.jobTitle,
    employmentType: jobContext.employmentType,
    startDate: jobContext.startDate,
    payRate,
    payFrequency: jobContext.payFrequency,
    managerName,
    ...personal,
  };
}

export function buildFirmaRecipientPrefillPayload(
  prefill: FirmaSigningPrefillValues,
  identity?: { firstName?: string | null; lastName?: string | null }
): Record<string, unknown> {
  const customFields: Record<string, string> = {};

  const put = (key: string, value: string | null | undefined) => {
    const cleaned = clean(value);
    if (cleaned) customFields[key] = cleaned;
  };

  // Mirror palette custom-field keys into custom_fields so dragged workspace
  // fields (First Name, Street Address, etc.) prefill even when the editor
  // wires format_rules.prefilledData to the custom field name.
  put("first_name", identity?.firstName);
  put("last_name", identity?.lastName);
  put("street_address", prefill.streetAddress);
  put("address_line_2", prefill.addressLine2);
  put("city", prefill.city);
  put("state_province", prefill.stateProvince);
  put("postal_code", prefill.postalCode);
  put("country", prefill.country);
  put("job_title", prefill.jobTitle);
  put("position_title", prefill.jobTitle);
  put("candidate_address", prefill.fullAddress);
  put("date_of_birth", prefill.dateOfBirth);
  put("ssn_last_four", prefill.ssnLastFour);
  put("employment_type", prefill.employmentType);
  put("start_date", prefill.startDate);
  put("hire_date", prefill.startDate);
  put("pay_rate", prefill.payRate);
  put("compensation", prefill.payRate);
  put("pay_frequency", prefill.payFrequency);
  put("manager_name", prefill.managerName);
  put("hiring_manager_name", prefill.managerName);

  return {
    ...(prefill.jobTitle ? { title: prefill.jobTitle } : {}),
    ...(prefill.phone ? { phone_number: prefill.phone } : {}),
    ...(prefill.streetAddress ? { street_address: prefill.streetAddress } : {}),
    ...(prefill.city ? { city: prefill.city } : {}),
    ...(prefill.stateProvince ? { state_province: prefill.stateProvince } : {}),
    ...(prefill.postalCode ? { postal_code: prefill.postalCode } : {}),
    ...(prefill.country ? { country: prefill.country } : {}),
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
    case "candidate_phone":
      return clean(input.prefill.phone);
    case "candidate_address":
      return prefillFullAddress(input.prefill);
    case "candidate_address_line_2":
      return clean(input.prefill.addressLine2);
    case "candidate_city":
      return clean(input.prefill.city);
    case "candidate_state":
      return clean(input.prefill.stateProvince);
    case "candidate_postal_code":
      return clean(input.prefill.postalCode);
    case "candidate_country":
      return clean(input.prefill.country);
    case "date_of_birth":
      return clean(input.prefill.dateOfBirth);
    case "ssn_last_four":
      return clean(input.prefill.ssnLastFour);
    case "position_title":
      return clean(input.prefill.jobTitle);
    case "employment_type":
      return clean(input.prefill.employmentType);
    case "start_date":
      return clean(input.prefill.startDate);
    case "compensation":
    case "pay_rate":
      return clean(input.prefill.payRate);
    case "pay_frequency":
      return clean(input.prefill.payFrequency);
    case "hiring_manager_name":
      return clean(input.prefill.managerName);
    default:
      return null;
  }
}

function prefillFullAddress(prefill: FirmaSigningPrefillValues): string | null {
  return (
    clean(prefill.fullAddress) ??
    formatFirmaSigningFullAddress({
      streetAddress: prefill.streetAddress,
      addressLine2: prefill.addressLine2,
      city: prefill.city,
      stateProvince: prefill.stateProvince,
      postalCode: prefill.postalCode,
      country: prefill.country,
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
