import { describe, expect, it } from "vitest";
import { staffModuleGrantFor } from "./use-staff-module-access";
import { classifyProtectedPath } from "@/lib/auth/permission-catalog";

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

  it("resolves module keys from page paths via the permission catalog", () => {
    expect(classifyProtectedPath("/admin_recruiter/jobs")).toMatchObject({
      kind: "resource",
      resourceKey: "jobs",
    });
    expect(classifyProtectedPath("/admin_recruiter/candidates")).toMatchObject({
      kind: "resource",
      resourceKey: "hiring",
    });
    expect(classifyProtectedPath("/admin_recruiter/mail")).toMatchObject({
      kind: "resource",
      resourceKey: "mail",
    });
    expect(classifyProtectedPath("/admin_recruiter/messages")).toMatchObject({
      kind: "resource",
      resourceKey: "chat",
    });
    expect(classifyProtectedPath("/admin_recruiter/facilities")).toMatchObject({
      kind: "resource",
      resourceKey: "organization",
    });
  });
});
