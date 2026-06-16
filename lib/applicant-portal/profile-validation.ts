export type ApplicantProfileInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
};

export type ApplicantProfileFieldErrors = Partial<Record<keyof ApplicantProfileInput, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateApplicantProfileInput(
  input: Partial<ApplicantProfileInput>
): { ok: true; value: ApplicantProfileInput } | { ok: false; errors: ApplicantProfileFieldErrors } {
  const errors: ApplicantProfileFieldErrors = {};
  const first_name = input.first_name?.trim() ?? "";
  const last_name = input.last_name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const address1 = input.address1?.trim() ?? "";
  const address2 = input.address2?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  const zip = input.zip?.trim() ?? "";

  if (!first_name) errors.first_name = "First name is required.";
  if (!last_name) errors.last_name = "Last name is required.";
  if (!email) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!phone) errors.phone = "Phone number is required.";
  if (!address1) errors.address1 = "Street address is required.";
  if (!city) errors.city = "City is required.";
  if (!state) errors.state = "State is required.";
  if (!zip) errors.zip = "ZIP code is required.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { first_name, last_name, email, phone, address1, address2, city, state, zip },
  };
}
