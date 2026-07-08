import {
  COMPANY_SIZE_OPTIONS,
  INDUSTRY_OPTIONS,
} from "@/app/tenant-onboarding/constants";
import { zipPrefixBelongsToState } from "@/lib/us-zip-by-state";

export type BusinessInfoInput = {
  companyName: string;
  industry: string;
  companySize: string;
  state: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  zipCode: string;
  ein: string;
};

export type BusinessInfoFieldKey = keyof BusinessInfoInput;

export type BusinessInfoFieldErrors = Partial<Record<BusinessInfoFieldKey, string>>;

export type BusinessInfoValidationContext = {
  /** Two-letter state code for ZIP/state checks. */
  stateCode?: string;
  /** Full state name for user-facing ZIP errors. */
  stateName?: string;
  /** When non-empty, city must be one of these names (dropdown mode). */
  allowedCityNames?: string[];
  /** When true, state must appear in this list (state name). */
  allowedStateNames?: string[];
  /** Tenant onboarding requires a valid EIN; admin profile may leave it blank. */
  requireEin?: boolean;
  /** When false, empty fields are allowed (tenant onboarding business step skipped). */
  requireAllFields?: boolean;
};

function fieldProvided(value: string): boolean {
  return value.trim().length > 0;
}

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const VALID_EIN_PREFIXES = new Set([
  "01", "02", "03", "04", "05", "06",
  "10", "11", "12", "13", "14", "15", "16",
  "20", "21", "22", "23", "24", "25", "26", "27",
  "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48",
  "50", "51", "52", "53", "54", "55", "56", "57", "58", "59",
  "60", "61", "62", "63", "64", "65", "66", "67", "68",
  "71", "72", "73", "74", "75", "76", "77",
  "80", "81", "82", "83", "84", "85", "86", "87", "88",
  "90", "91", "92", "93", "94", "95", "98", "99",
]);

const FAKE_PHONE_PATTERNS = [
  /^(\d)\1{9}$/,
  /^0123456789$/,
  /^1234567890$/,
  /^9876543210$/,
  /^55501\d{4}$/,
];

export function normalizeBusinessZipInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

export function normalizeEinInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function normalizeBusinessPhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidBusinessCompanyName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  if (/^[\d\s\W_]+$/.test(trimmed)) return false;
  return true;
}

export function companyNameValidationMessage(
  name: string,
  options?: { required?: boolean }
): string | null {
  const trimmed = name.trim();
  const required = options?.required !== false;
  if (!trimmed) return required ? "Company name is required." : null;
  if (!isValidBusinessCompanyName(name)) {
    return "Enter a valid business name (must include letters, not only numbers or symbols).";
  }
  return null;
}

/** Tenant display name when business info was skipped or company name left blank. */
export function resolveTenantDisplayName(params: {
  organizationName?: string;
  subdomain?: string;
  adminEmail?: string;
}): string {
  const org = params.organizationName?.trim() ?? "";
  if (org && isValidBusinessCompanyName(org)) return org;

  const sub = params.subdomain?.trim();
  if (sub) {
    return sub
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  const localPart = params.adminEmail?.trim().split("@")[0]?.trim();
  if (localPart) {
    return localPart
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return "My Organization";
}

export function industryValidationMessage(
  industry: string,
  options?: { required?: boolean }
): string | null {
  const value = industry.trim();
  const required = options?.required !== false;
  if (!value) return required ? "Industry is required." : null;
  if (!(INDUSTRY_OPTIONS as readonly string[]).includes(value)) {
    return "Select a valid industry.";
  }
  return null;
}

export function companySizeValidationMessage(
  companySize: string,
  options?: { required?: boolean }
): string | null {
  const value = companySize.trim();
  const required = options?.required !== false;
  if (!value) return required ? "Number of employees is required." : null;
  if (!(COMPANY_SIZE_OPTIONS as readonly string[]).includes(value)) {
    return "Select a valid employee range.";
  }
  return null;
}

export function stateValidationMessage(
  state: string,
  context?: BusinessInfoValidationContext
): string | null {
  const value = state.trim();
  const required = context?.requireAllFields !== false;
  if (!value) return required ? "State is required." : null;
  if (context?.allowedStateNames?.length && !context.allowedStateNames.includes(value)) {
    return "Select a valid state.";
  }
  return null;
}

export function cityValidationMessage(
  city: string,
  context?: BusinessInfoValidationContext
): string | null {
  const value = city.trim();
  const required = context?.requireAllFields !== false;
  if (!value) return required ? "City is required." : null;
  if (context?.allowedCityNames?.length && !context.allowedCityNames.includes(value)) {
    return "Select a valid city for the selected state.";
  }
  if (!/^[a-zA-Z][a-zA-Z\s.'-]{1,}$/.test(value)) {
    return "Enter a valid city name.";
  }
  return null;
}

export function addressVerificationMessage(
  address: string,
  options: { isAddressVerified: boolean; showError: boolean }
): string | null {
  if (!options.showError) return null
  const formatError = addressValidationMessage(address)
  if (formatError) return null
  if (!options.isAddressVerified) {
    return "Select a street address from the suggestions to continue."
  }
  return null
}

export function addressValidationMessage(
  address: string,
  options?: { required?: boolean }
): string | null {
  const trimmed = address.trim();
  const required = options?.required !== false;
  if (!trimmed) return required ? "Business address is required." : null;
  if (trimmed.length < 5) return "Enter a complete street address.";
  if (!/\d/.test(trimmed)) return "Enter a valid street address with a street number.";
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return "Enter a valid street address.";
  if (/^(.)\1{4,}$/.test(trimmed.replace(/\s/g, ""))) {
    return "Enter a valid street address.";
  }
  return null;
}

export function phoneValidationMessage(
  phone: string,
  options?: { required?: boolean }
): string | null {
  const trimmed = phone.trim();
  const required = options?.required !== false;
  if (!trimmed) return required ? "Business phone is required." : null;
  if (/[a-zA-Z]/.test(trimmed)) return "Phone number cannot contain letters.";
  const digits = normalizeBusinessPhoneDigits(trimmed);
  if (digits.length !== 10) {
    return "Enter a valid 10-digit US phone number.";
  }
  if (FAKE_PHONE_PATTERNS.some((pattern) => pattern.test(digits))) {
    return "Enter a valid phone number.";
  }
  if (digits[0] === "0" || digits[0] === "1") {
    return "Enter a valid US phone number.";
  }
  return null;
}

export function emailValidationMessage(
  email: string,
  options?: { required?: boolean }
): string | null {
  const trimmed = email.trim();
  const required = options?.required !== false;
  if (!trimmed) return required ? "Business email address is required." : null;
  if (!trimmed.includes("@")) return "Enter a valid email address (e.g. name@company.com).";
  const parts = trimmed.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return "Enter a valid email address (e.g. name@company.com).";
  }
  const domain = parts[1];
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "Enter a valid email address with a domain extension.";
  }
  const tld = domain.split(".").pop() ?? "";
  if (tld.length < 2) return "Enter a valid email address with a domain extension.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address (e.g. name@company.com).";
  return null;
}

export function zipCodeValidationMessage(
  zipCode: string,
  context?: BusinessInfoValidationContext,
  inputState?: string
): string | null {
  const digits = normalizeBusinessZipInput(zipCode);
  const required = context?.requireAllFields !== false;
  if (!digits) return required ? "ZIP code is required." : null;
  if (digits.length < 5) return "Enter a valid 5-digit ZIP code.";
  if (!context?.stateCode) {
    if (fieldProvided(inputState ?? "") || required) {
      return "Select a state before entering a ZIP code.";
    }
    return null;
  }
  if (!zipPrefixBelongsToState(digits, context.stateCode)) {
    const stateLabel = context.stateName?.trim() || "the selected state";
    return `This ZIP code does not match ${stateLabel}.`;
  }
  return null;
}

export function einValidationMessage(
  ein: string,
  options?: { required?: boolean }
): string | null {
  const trimmed = ein.trim();
  if (!trimmed) {
    return options?.required ? "EIN number is required." : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length !== 9) {
    return "EIN must be 9 digits in XX-XXXXXXX format.";
  }
  const prefix = digits.slice(0, 2);
  if (!VALID_EIN_PREFIXES.has(prefix)) {
    return "Enter a valid EIN number.";
  }
  return null;
}

export function validateBusinessInfoForm(
  input: BusinessInfoInput,
  context?: BusinessInfoValidationContext
): BusinessInfoFieldErrors {
  const errors: BusinessInfoFieldErrors = {};
  const requireAll = context?.requireAllFields !== false;

  const companyNameError = companyNameValidationMessage(input.companyName, {
    required: requireAll,
  });
  if (companyNameError) errors.companyName = companyNameError;

  const industryError = industryValidationMessage(input.industry, {
    required: requireAll,
  });
  if (industryError) errors.industry = industryError;

  const companySizeError = companySizeValidationMessage(input.companySize, {
    required: requireAll,
  });
  if (companySizeError) errors.companySize = companySizeError;

  const stateError = stateValidationMessage(input.state, context);
  if (stateError) errors.state = stateError;

  const cityError = cityValidationMessage(input.city, context);
  if (cityError) errors.city = cityError;

  const addressError = addressValidationMessage(input.address, {
    required: requireAll,
  });
  if (addressError) errors.address = addressError;

  const phoneError = phoneValidationMessage(input.phone, {
    required: requireAll,
  });
  if (phoneError) errors.phone = phoneError;

  const emailError = emailValidationMessage(input.email, {
    required: requireAll,
  });
  if (emailError) errors.email = emailError;

  const zipError = zipCodeValidationMessage(input.zipCode, context, input.state);
  if (zipError) errors.zipCode = zipError;

  const einError = einValidationMessage(input.ein, {
    required: requireAll && context?.requireEin === true,
  });
  if (einError) errors.ein = einError;

  return errors;
}

export function isBusinessInfoValid(
  input: BusinessInfoInput,
  context?: BusinessInfoValidationContext
): boolean {
  return Object.keys(validateBusinessInfoForm(input, context)).length === 0;
}

export function firstBusinessInfoError(
  errors: BusinessInfoFieldErrors
): string | null {
  const values = Object.values(errors);
  return values.length > 0 ? values[0] : null;
}

export function normalizeBusinessInfoBody(
  body: Record<string, unknown>
): BusinessInfoInput {
  return {
    companyName: String(body.companyName ?? body.organizationName ?? "").trim(),
    industry: String(body.industry ?? "").trim(),
    companySize: String(body.companySize ?? body.company_size ?? "").trim(),
    state: String(body.state ?? "").trim(),
    city: String(body.city ?? "").trim(),
    address: String(body.address ?? body.address_line_1 ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    email: String(body.email ?? "").trim().toLowerCase(),
    zipCode: normalizeBusinessZipInput(String(body.zipCode ?? body.postal_code ?? "")),
    ein: normalizeEinInput(String(body.ein ?? "")),
  };
}
