import { describe, expect, it } from "vitest";
import {
  BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS,
  findMissingBrassHrFirmaWorkspaceSigningCustomFields,
} from "@/lib/firma/ensure-workspace-signing-custom-fields";

describe("findMissingBrassHrFirmaWorkspaceSigningCustomFields", () => {
  it("returns the full BrassHR catalog when the workspace has no custom fields", () => {
    expect(findMissingBrassHrFirmaWorkspaceSigningCustomFields([])).toEqual([
      ...BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS,
    ]);
  });

  it("skips fields that already exist by field_name or label (case-insensitive)", () => {
    const missing = findMissingBrassHrFirmaWorkspaceSigningCustomFields([
      { field_name: "FIRST_NAME", field_label: "Someone" },
      { field_name: "other", field_label: "City" },
      { field_name: "pay_rate", field_label: "Pay Rate" },
    ]);

    const names = missing.map((field) => field.field_name);
    expect(names).not.toContain("first_name");
    expect(names).not.toContain("city");
    expect(names).not.toContain("pay_rate");
    expect(names).toContain("last_name");
    expect(names).toContain("street_address");
    expect(names).toContain("ssn_last_four");
  });

  it("includes First Name and Last Name in the catalog for the Field Types palette", () => {
    const names = BRASSHR_FIRMA_WORKSPACE_SIGNING_CUSTOM_FIELDS.map((field) => field.field_name);
    expect(names).toEqual(
      expect.arrayContaining([
        "first_name",
        "last_name",
        "street_address",
        "address_line_2",
        "date_of_birth",
        "ssn_last_four",
        "employment_type",
        "manager_name",
      ])
    );
  });
});
