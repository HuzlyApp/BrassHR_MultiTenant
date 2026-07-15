/**
 * Public job serialization — never expose internal/sensitive fields.
 */

export type PublicJobFields = {
  id: string;
  jobNumber: string | null;
  title: string;
  description: string | null;
  profession: string | null;
  specialty: string | null;
  location: string | null;
  locationType: string | null;
  city: string | null;
  stateProvince: string | null;
  employmentType: string;
  benefitsSummary: string | null;
  jobDuration: string | null;
  targetStartDate: string | null;
  requiredCredentials: unknown;
  qualifications: string | null;
  specialRequirements: string | null;
  payRate: number | null;
  rateUnit: string | null;
  currency: string | null;
  publicJobToken: string | null;
};

const PRIVATE_KEYS = new Set([
  "internal_notes",
  "bill_rate",
  "msp_id",
  "msp_name",
  "msp_client_id",
  "msp_client_name",
  "external_req_id",
  "source_job_url",
  "source_job_details",
  "eor_tenant_id",
  "workflow_template_id",
  "workflow_assignment_error",
  "onboarding_workflow_id",
  "onboarding_workflow_override",
  "approval_required",
  "approved_by",
  "rejection_reason",
  "created_by",
  "assigned_recruiter",
  "idempotency_key",
]);

export function redactPrivateJobFields<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (PRIVATE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

export function toPublicJobPayload(row: Record<string, unknown>): PublicJobFields {
  const payRatePublic = row.pay_rate_public === true;
  return {
    id: String(row.id),
    jobNumber: row.job_number != null ? String(row.job_number) : null,
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    profession:
      row.profession != null
        ? String(row.profession)
        : row.job_role != null
          ? String(row.job_role)
          : null,
    specialty: row.specialty != null ? String(row.specialty) : null,
    location: row.location != null ? String(row.location) : null,
    locationType: row.location_type != null ? String(row.location_type) : null,
    city: row.city != null ? String(row.city) : null,
    stateProvince: row.state_province != null ? String(row.state_province) : null,
    employmentType: String(row.employment_type ?? ""),
    benefitsSummary: row.benefits_summary != null ? String(row.benefits_summary) : null,
    jobDuration: row.job_duration != null ? String(row.job_duration) : null,
    targetStartDate: row.target_start_date != null ? String(row.target_start_date) : null,
    requiredCredentials: row.required_credentials ?? [],
    qualifications: row.qualifications != null ? String(row.qualifications) : null,
    specialRequirements:
      row.special_requirements != null ? String(row.special_requirements) : null,
    payRate: payRatePublic && row.pay_rate != null ? Number(row.pay_rate) : null,
    rateUnit: payRatePublic && row.rate_unit != null ? String(row.rate_unit) : null,
    currency: payRatePublic ? String(row.currency ?? "USD") : null,
    publicJobToken: row.public_job_token != null ? String(row.public_job_token) : null,
  };
}

export function hasPrivateLeak(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).filter((k) => PRIVATE_KEYS.has(k) || PRIVATE_KEYS.has(toSnake(k)));
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
