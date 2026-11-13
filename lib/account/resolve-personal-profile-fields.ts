import { formatPhoneNumber } from "@/lib/phone";
import type { AccountOrganization, AccountProfile } from "./types";

/** Staff profile fields only — never fall back to tenant/company address. */
export function resolvePersonalProfileFields(
  profile: AccountProfile | null,
  _organization: AccountOrganization | null = null
) {
  const phoneRaw = profile?.phone?.trim() ?? "";

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
    city: profile?.city?.trim() ?? "",
    state: profile?.state?.trim() ?? "",
    zipCode: profile?.zip_code?.trim() ?? "",
    address: profile?.address_line1?.trim() ?? "",
    addressLine2: profile?.address_line2?.trim() ?? "",
  };
}
