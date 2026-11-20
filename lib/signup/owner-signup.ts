import { industryKeyFromLegacyLabel } from "@/lib/ai-catalog/industry-catalog";
import { isPersonNameTooLong, personNameTooLongMessage } from "@/lib/person-name";
import { normalizePhoneInput } from "@/lib/phone";
import {
  phoneValidationMessage,
  zipCodeValidationMessage,
} from "@/lib/tenant/business-info-validation";
import type { TenantCategory } from "@/lib/tenant/tenant-category";

function isGarbageAddressText(value: string): boolean {
  return /^(.)\1{4,}$/.test(value.replace(/\s/g, ""));
}

/** Street address line 1 for owner signup (simple messages for the signup form). */
export function signupAddress1ValidationMessage(address1: string): string | null {
  const trimmed = address1.trim();
  if (!trimmed) return "Enter your address.";
  if (trimmed.length < 5) return "Enter full address.";
  if (!/\d/.test(trimmed)) return "Add your street number.";
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return "Enter a valid address.";
  if (isGarbageAddressText(trimmed)) return "Enter a valid address.";
  return null;
}

/** Mapbox street-address selection required before continuing signup. */
export function signupAddressVerificationMessage(
  options: {
    address1: string
    isAddressVerified: boolean
    showError: boolean
  }
): string | null {
  if (!options.showError) return null
  const formatError = signupAddress1ValidationMessage(options.address1)
  if (formatError) return null
  if (!options.isAddressVerified) {
    return "Select a street address from the suggestions to continue.";
  }
  return null;
}

/** Optional address line 2 (apartment, suite, floor). */
export function signupAddress2ValidationMessage(
  address2: string,
  options: { sameAsAddress1: boolean }
): string | null {
  if (options.sameAsAddress1) return null;
  const trimmed = address2.trim();
  if (!trimmed) return null;
  if (trimmed.length < 2) return "Enter apartment or suite.";
  if (isGarbageAddressText(trimmed)) return "Enter valid details.";
  return null;
}

export type OwnerSignupPayload = {
  firstName: string;
  lastName: string;
  workEmail: string;
  jobTitle: string;
  city: string;
  state: string;
  zipCode: string;
  address1: string;
  address2: string;
  password: string;
  phone?: string;
  companyName?: string;
  companyWebsite?: string;
  industry?: string;
  /** Additional / all selected industry labels (primary is industries[0] or industry). */
  industries?: string[];
  /** true = Staffing edition, false = SMB */
  isStaffingCompany?: boolean | null;
  hqState?: string;
  primaryCity?: string;
  primaryState?: string;
};

export type SignupStateOption = {
  code: string;
  name: string;
};

export type SignupCityOption = {
  name: string;
  stateCode: string;
};

function normalizeOptionalWebsite(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeIndustryLabels(body: Record<string, unknown>): string[] {
  const fromArray = Array.isArray(body.industries)
    ? body.industries.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const primary = String(body.industry ?? "").trim();
  const merged = [...fromArray];
  if (primary && !merged.includes(primary)) merged.unshift(primary);
  return [...new Set(merged)];
}

export function normalizeOwnerSignupBody(body: Record<string, unknown>): Partial<OwnerSignupPayload> {
  const staffingRaw = body.isStaffingCompany;
  const isStaffingCompany =
    staffingRaw === true || staffingRaw === "true"
      ? true
      : staffingRaw === false || staffingRaw === "false"
        ? false
        : null;
  const industries = normalizeIndustryLabels(body);

  return {
    firstName: String(body.firstName ?? "").trim(),
    lastName: String(body.lastName ?? "").trim(),
    workEmail: String(body.workEmail ?? "")
      .trim()
      .toLowerCase(),
    jobTitle: String(body.jobTitle ?? "").trim(),
    phone: normalizePhoneInput(String(body.phone ?? "")),
    companyName: String(body.companyName ?? "").trim(),
    companyWebsite: normalizeOptionalWebsite(body.companyWebsite),
    industry: industries[0] ?? "",
    industries,
    isStaffingCompany,
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    zipCode: String(body.zipCode ?? "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 5),
    address1: String(body.address1 ?? "").trim(),
    address2: String(body.address2 ?? "").trim(),
    password: String(body.password ?? ""),
    hqState: String(body.hqState ?? body.state ?? "").trim(),
    primaryCity: String(body.primaryCity ?? body.city ?? "").trim(),
    primaryState: String(body.primaryState ?? body.state ?? "").trim(),
  };
}

export function tenantCategoryFromStaffingFlag(
  isStaffingCompany: boolean | null | undefined
): TenantCategory {
  return isStaffingCompany === false ? "SMB" : "Staffing";
}

export function validateOwnerSignupDetails(
  payload: Partial<OwnerSignupPayload>
): string | null {
  if (!payload.firstName) return "First name is required.";
  if (isPersonNameTooLong(payload.firstName)) return personNameTooLongMessage("First name");
  if (!payload.lastName) return "Last name is required.";
  if (isPersonNameTooLong(payload.lastName)) return personNameTooLongMessage("Last name");
  if (!payload.workEmail?.includes("@")) return "A valid work email is required.";
  if (!payload.companyName?.trim()) return "Company name is required.";
  const industries =
    payload.industries && payload.industries.length > 0
      ? payload.industries
      : payload.industry?.trim()
        ? [payload.industry.trim()]
        : [];
  if (industries.length === 0) return "Select at least one industry.";
  const invalid = industries.find((label) => !industryKeyFromLegacyLabel(label));
  if (invalid) return "Select a valid industry.";
  if (payload.isStaffingCompany !== true && payload.isStaffingCompany !== false) {
    return "Select whether you are a staffing company.";
  }
  const phoneError = phoneValidationMessage(payload.phone ?? "", { required: false });
  if (phoneError) return phoneError;
  if (!payload.city) return "City is required.";
  if (!payload.state) return "State is required.";
  if (!(payload.hqState || payload.state)) return "Headquarters state is required.";
  if (!(payload.primaryCity || payload.city) || !(payload.primaryState || payload.state)) {
    return "Primary work location is required.";
  }
  const zip = (payload.zipCode ?? "").trim();
  if (zip && zip.length < 5) return "Enter a valid 5-digit ZIP code.";
  const address1 = (payload.address1 ?? "").trim();
  if (address1) {
    const address1Error = signupAddress1ValidationMessage(address1);
    if (address1Error) return address1Error;
  }
  const address2 = (payload.address2 ?? "").trim();
  if (address2 && address2 !== address1) {
    const address2Error = signupAddress2ValidationMessage(address2, { sameAsAddress1: false });
    if (address2Error) return address2Error;
  }
  return null;
}

/** Auth user_metadata written at owner signup for tenant-onboarding prefill. */
export function buildOwnerSignupUserMetadata(payload: OwnerSignupPayload) {
  const industries =
    payload.industries && payload.industries.length > 0
      ? payload.industries
      : payload.industry?.trim()
        ? [payload.industry.trim()]
        : [];
  const primaryLabel = industries[0] ?? payload.industry ?? "";
  const industryKey = industryKeyFromLegacyLabel(primaryLabel) ?? null;
  const industryKeys = industries
    .map((label) => industryKeyFromLegacyLabel(label))
    .filter((key): key is NonNullable<typeof key> => Boolean(key));
  return {
    first_name: payload.firstName,
    last_name: payload.lastName,
    job_title: payload.jobTitle || null,
    phone: payload.phone || null,
    city: payload.city,
    state: payload.state,
    zip_code: payload.zipCode || null,
    company_name: payload.companyName || null,
    company_website: payload.companyWebsite || null,
    industry: primaryLabel || null,
    industries,
    industry_key: industryKey,
    industry_keys: industryKeys,
    is_staffing_company: payload.isStaffingCompany === true,
    tenant_category: tenantCategoryFromStaffingFlag(payload.isStaffingCompany),
  };
}

/** Validates ZIP format and that the prefix matches the selected US state. */
export function validateOwnerSignupZipForState(
  zipCode: string,
  stateCode: string,
  stateName?: string
): string | null {
  return zipCodeValidationMessage(zipCode, { stateCode, stateName });
}

export function validateOwnerSignupPassword(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/\d/.test(password)) return "Password must contain at least one number.";
  return null;
}

/**
 * Row shape for public.users upsert after owner signup.
 * Matches columns on public.users (id = auth.users.id, tenant_id stays null until tenant onboarding).
 */
export function buildUsersSignupRow(
  userId: string,
  payload: OwnerSignupPayload,
  completedAt: string
) {
  return {
    id: userId,
    email: payload.workEmail,
    first_name: payload.firstName,
    last_name: payload.lastName,
    job_title: payload.jobTitle || null,
    phone: payload.phone || null,
    address_line1: payload.address1 || null,
    address_line2: payload.address2 || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zipCode || null,
    hq_state: payload.hqState || payload.state || null,
    primary_city: payload.primaryCity || payload.city || null,
    primary_state: payload.primaryState || payload.state || null,
    primary_postal_code: payload.zipCode || null,
    role: "admin" as const,
    email_verified: true,
    signup_completed_at: completedAt,
    updated_at: completedAt,
  };
}
