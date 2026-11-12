import { formatPhoneNumber } from "@/lib/phone";
import type { AccountOrganization, AccountProfile } from "./types";

function pickString(
  primary: string | null | undefined,
  fallback: string | null | undefined
): string {
  const a = primary?.trim() ?? "";
  if (a) return a;
  return fallback?.trim() ?? "";
}

/** Merge staff profile row with tenant onboarding business info for the personal tab. */
export function resolvePersonalProfileFields(
  profile: AccountProfile | null,
  organization: AccountOrganization | null
) {
  const phoneRaw = pickString(profile?.phone, null);
  const companyPhoneRaw = pickString(organization?.phone, null);

  return {
    firstName: profile?.first_name?.trim() ?? "",
    lastName: profile?.last_name?.trim() ?? "",
    preferredName: profile?.preferred_name?.trim() ?? "",
    workEmail: profile?.email?.trim() ?? "",
    jobTitle: profile?.job_title?.trim() ?? "",
    phone: phoneRaw ? formatPhoneNumber(phoneRaw) : "",
    birthdate: profile?.birthdate?.trim() ?? "",
    departmentId: profile?.department_id?.trim() ?? "",
    employeeId: profile?.employee_id?.trim() ?? "",
    workLocation: profile?.work_location?.trim() ?? "",
    bio: profile?.bio?.trim() ?? "",
    city: pickString(profile?.city, organization?.city),
    state: pickString(profile?.state, organization?.state),
    zipCode: pickString(profile?.zip_code, organization?.postal_code),
    address: pickString(profile?.address_line1, organization?.address_line_1),
    addressLine2: pickString(profile?.address_line2, organization?.address_line_2),
    companyEin: organization?.ein?.trim() ?? "",
    companyPhone: companyPhoneRaw ? formatPhoneNumber(companyPhoneRaw) : "",
    companyEmail: organization?.email?.trim() ?? "",
    companyWebsite: organization?.website?.trim() ?? "",
  };
}
