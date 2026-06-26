import { zipCodeValidationMessage } from "@/lib/tenant/business-info-validation";

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
};

export type SignupStateOption = {
  code: string;
  name: string;
};

export type SignupCityOption = {
  name: string;
  stateCode: string;
};

export function normalizeOwnerSignupBody(body: Record<string, unknown>): Partial<OwnerSignupPayload> {
  return {
    firstName: String(body.firstName ?? "").trim(),
    lastName: String(body.lastName ?? "").trim(),
    workEmail: String(body.workEmail ?? "")
      .trim()
      .toLowerCase(),
    jobTitle: String(body.jobTitle ?? "").trim(),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    zipCode: String(body.zipCode ?? "")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 5),
    address1: String(body.address1 ?? "").trim(),
    address2: String(body.address2 ?? "").trim(),
    password: String(body.password ?? ""),
  };
}

export function validateOwnerSignupDetails(
  payload: Partial<OwnerSignupPayload>
): string | null {
  if (!payload.firstName) return "First name is required.";
  if (!payload.lastName) return "Last name is required.";
  if (!payload.workEmail?.includes("@")) return "A valid work email is required.";
  if (!payload.jobTitle) return "Job title is required.";
  if (!payload.city) return "City is required.";
  if (!payload.state) return "State is required.";
  if (!payload.zipCode || payload.zipCode.length < 5) return "Enter a valid 5-digit ZIP code.";
  return null;
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
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[\d\W_]/.test(password)) return "Password must contain a number or special character.";
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
    address_line1: payload.address1 || null,
    address_line2: payload.address2 || null,
    city: payload.city || null,
    state: payload.state || null,
    zip_code: payload.zipCode || null,
    role: "admin" as const,
    email_verified: true,
    signup_completed_at: completedAt,
    updated_at: completedAt,
  };
}
