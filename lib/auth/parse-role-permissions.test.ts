import { describe, expect, it } from "vitest";
import { parseRolePermissionGrants } from "@/lib/auth/parse-role-permissions";

const none = () => ({ canView: false, canEdit: false, canDelete: false });

describe("parseRolePermissionGrants", () => {
  it("returns null when permissions is not an array", () => {
    expect(parseRolePermissionGrants(undefined, new Set(["hiring"]), none)).toBeNull();
    expect(parseRolePermissionGrants({}, new Set(["hiring"]), none)).toBeNull();
  });

  it("ignores always-granted / unknown keys instead of failing", () => {
    const allowed = new Set(["hiring", "people"]);
    const grants = parseRolePermissionGrants(
      [
        { resourceKey: "hiring", canView: true, canEdit: true, canDelete: false },
        { resourceKey: "settings_help", canView: true, canEdit: false, canDelete: false },
        { resourceKey: "dashboard", canView: true, canEdit: false, canDelete: false },
      ],
      allowed,
      none
    );
    expect(grants).toEqual([
      { resourceKey: "hiring", canView: true, canEdit: true, canDelete: false },
      { resourceKey: "people", canView: false, canEdit: false, canDelete: false },
    ]);
  });

  it("skips duplicate keys and fills missing editable resources", () => {
    const allowed = new Set(["hiring", "mail"]);
    const grants = parseRolePermissionGrants(
      [
        { resourceKey: "hiring", canView: true, canEdit: false, canDelete: false },
        { resourceKey: "hiring", canView: true, canEdit: true, canDelete: true },
      ],
      allowed,
      none
    );
    expect(grants).toEqual([
      { resourceKey: "hiring", canView: true, canEdit: false, canDelete: false },
      { resourceKey: "mail", canView: false, canEdit: false, canDelete: false },
    ]);
  });

  it("keeps view when edit or delete is set", () => {
    const allowed = new Set(["jobs"]);
    const grants = parseRolePermissionGrants(
      [{ resourceKey: "jobs", canView: false, canEdit: true, canDelete: false }],
      allowed,
      none
    );
    expect(grants).toEqual([{ resourceKey: "jobs", canView: true, canEdit: true, canDelete: false }]);
  });
});
