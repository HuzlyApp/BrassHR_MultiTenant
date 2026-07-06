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
  const phoneRaw = pickString(profile?.phone, organization?.phone);

  return {
    firstName: profile?.first_name?.trim() ?? "",
    lastName: profile?.last_name?.trim() ?? "",
    workEmail: profile?.email?.trim() ?? "",
    jobTitle: profile?.job_title?.trim() ?? "",
    phone: phoneRaw ? formatPhoneNumber(phoneRaw) : "",
    city: pickString(profile?.city, organization?.city),
    state: pickString(profile?.state, organization?.state),
    zipCode: pickString(profile?.zip_code, organization?.postal_code),
    address: pickString(profile?.address_line1, organization?.address_line_1),
  };
}
