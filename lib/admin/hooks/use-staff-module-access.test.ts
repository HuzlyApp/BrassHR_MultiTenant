import { describe, expect, it } from "vitest";
import { staffModuleGrantFor } from "./use-staff-module-access";

describe("staffModuleGrantFor", () => {
  it("gives god admins full access", () => {
    expect(staffModuleGrantFor(undefined, true)).toEqual({
      canView: true,
      canEdit: true,
      canDelete: true,
    });
  });

  it("treats missing grants as deny", () => {
    expect(staffModuleGrantFor(undefined, false)).toEqual({
      canView: false,
      canEdit: false,
      canDelete: false,
    });
  });

  it("keeps view-only recruiter jobs grants", () => {
    expect(
      staffModuleGrantFor({ key: "jobs", canView: true, canEdit: false, canDelete: false }, false)
    ).toEqual({ canView: true, canEdit: false, canDelete: false });
  });
});
