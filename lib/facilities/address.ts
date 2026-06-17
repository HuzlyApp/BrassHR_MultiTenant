import type { FacilityFormInput } from "./types";

export function formatFacilityAddress(input: Pick<FacilityFormInput, "streetAddress" | "city" | "state" | "zipCode">): string {
  const street = input.streetAddress.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const zip = input.zipCode.trim();
  return [street, `${city}, ${state} ${zip}`.replace(/^,\s*/, "")].filter(Boolean).join(", ");
}

export function normalizeAddressKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFacilityName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildFacilityAbout(input: FacilityFormInput): string | null {
  const lines: string[] = [];
  const mailing = input.mailingAddress?.trim();
  const facilityType = input.facilityType?.trim();
  const email = input.email?.trim();
  const contactPerson = input.contactPerson?.trim();
  const notes = input.notes?.trim();

  if (mailing) lines.push(`Mailing Address: ${mailing}`);
  if (facilityType) lines.push(`Facility Type: ${facilityType}`);
  if (email) lines.push(`Email: ${email}`);
  if (contactPerson) lines.push(`Contact Person: ${contactPerson}`);
  if (notes) lines.push(`Notes: ${notes}`);

  return lines.length > 0 ? lines.join("\n") : null;
}

export function parseMailingAddressFromAbout(about: string | null | undefined): string {
  if (!about?.trim()) return "";
  const match = about.match(/^Mailing Address:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}

export function parseFacilityTypeFromAbout(about: string | null | undefined): string {
  if (!about?.trim()) return "";
  const match = about.match(/^Facility Type:\s*(.+)$/m);
  return match?.[1]?.trim() ?? "";
}
