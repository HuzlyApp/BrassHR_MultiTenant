import "server-only";
import {
  createFirmaWorkspaceCustomField,
  listFirmaWorkspaceCustomFields,
} from "@/lib/firma/client";
import { FirmaError } from "@/lib/firma/errors";
import type { FirmaWorkspaceCustomField } from "@/lib/firma/types";

/**
 * BrassHR candidate/employment fields that should appear in the Firma
 * embedded template editor Field Types palette (drag-and-drop).
 *
 * Built-in Firma personal types already cover Name / Email / Phone / Company /
 * Job Title — this catalog fills the gaps (First/Last Name, address parts,
 * personal + employment extras) using workspace custom field definitions.
 *
 * `field_name` must match recipient attrs or `custom_fields` keys used at send time.
 */
export const BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS = [
  { field_name: "first_name", field_label: "First Name" },
  { field_name: "last_name", field_label: "Last Name" },
  { field_name: "street_address", field_label: "Street Address" },
  { field_name: "address_line_2", field_label: "Address Line 2" },
  { field_name: "city", field_label: "City" },
  { field_name: "state_province", field_label: "State / Province" },
  { field_name: "postal_code", field_label: "ZIP / Postal Code" },
  { field_name: "country", field_label: "Country" },
  { field_name: "candidate_address", field_label: "Full Address" },
  { field_name: "date_of_birth", field_label: "Date of Birth" },
  { field_name: "ssn_last_four", field_label: "SSN (Last 4)" },
  { field_name: "employment_type", field_label: "Employment Type" },
  { field_name: "start_date", field_label: "Start / Hire Date" },
  { field_name: "pay_rate", field_label: "Pay Rate" },
  { field_name: "pay_frequency", field_label: "Pay Frequency" },
  { field_name: "manager_name", field_label: "Manager Name" },
] as const;

export type BrassHrFirmaWorkspaceSigningCustomField =
  (typeof BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS)[number];

export type EnsureFirmaWorkspaceSigningCustomFieldsResult = {
  workspaceId: string;
  existing: number;
  created: number;
  skippedConflict: number;
  fields: FirmaWorkspaceCustomField[];
};

function normalizeFieldKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function findMissingBrassHrFirmaWorkspaceSigningCustomFields(
  existing: ReadonlyArray<Pick<FirmaWorkspaceCustomField, "field_name" | "field_label">>
): BrassHrFirmaWorkspaceSigningCustomField[] {
  const present = new Set<string>();
  for (const field of existing) {
    const name = normalizeFieldKey(field.field_name);
    const label = normalizeFieldKey(field.field_label);
    if (name) present.add(name);
    if (label) present.add(label);
  }

  return BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS.filter((field) => {
    const name = normalizeFieldKey(field.field_name);
    const label = normalizeFieldKey(field.field_label);
    return !present.has(name) && !present.has(label);
  });
}

/**
 * Idempotently creates BrassHR signing custom fields on a Firma workspace so
 * they show up as drag-and-drop Field Types in the embedded template editor.
 */
export async function ensureBrassHrFirmaWorkspaceSigningCustomFields(
  workspaceId: string
): Promise<EnsureFirmaWorkspaceSigningCustomFieldsResult> {
  const existing = await listFirmaWorkspaceCustomFields(workspaceId);
  const missing = findMissingBrassHrFirmaWorkspaceSigningCustomFields(existing);

  const created: FirmaWorkspaceCustomField[] = [];
  let skippedConflict = 0;

  for (const field of missing) {
    try {
      const row = await createFirmaWorkspaceCustomField(workspaceId, {
        field_name: field.field_name,
        field_label: field.field_label,
      });
      created.push(row);
    } catch (err) {
      // Race / already exists — treat as present and continue.
      if (err instanceof FirmaError && err.status === 409) {
        skippedConflict += 1;
        continue;
      }
      throw err;
    }
  }

  const fields =
    created.length > 0 || skippedConflict > 0
      ? await listFirmaWorkspaceCustomFields(workspaceId)
      : existing;

  return {
    workspaceId,
    existing: existing.length,
    created: created.length,
    skippedConflict,
    fields,
  };
}
