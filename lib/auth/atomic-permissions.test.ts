import { describe, expect, it } from "vitest";
import { atomicPermissions } from "./atomic-permissions";

describe("atomic permission compatibility projection", () => {
  it("does not infer permissions from missing grants", () => {
    expect(atomicPermissions([], { manage_clients: true })).toEqual([]);
  });
  it("keeps edit and delete independent", () => {
    const keys = atomicPermissions([{ key: "people", canView: false, canEdit: true, canDelete: false }], {});
    expect(keys).toEqual(["workers.create", "workers.read", "workers.update"]);
    expect(atomicPermissions([{ key: "people", canView: false, canEdit: false, canDelete: true }], {}))
      .toEqual(["workers.delete", "workers.read"]);
  });
  it("withholds staffing and timesheet permissions when features are disabled", () => {
    const grants = ["organization", "scheduling"].map((key) => ({ key, canView: true, canEdit: true, canDelete: true }));
    const disabled = atomicPermissions(grants, {});
    expect(disabled).not.toContain("clients.manage");
    expect(disabled).not.toContain("timesheets.approve");
    expect(atomicPermissions(grants, { manage_clients: true, timesheets: true }))
      .toEqual(expect.arrayContaining(["clients.manage", "timesheets.approve"]));
  });
  it("does not turn universal Help access into ticket-management permission", () => {
    expect(atomicPermissions([{ key: "settings_help", canView: true, canEdit: true, canDelete: true }], {})).toEqual([]);
  });
});
