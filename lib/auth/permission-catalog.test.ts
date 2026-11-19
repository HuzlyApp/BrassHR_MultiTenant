import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIMITED_STAFF_RESOURCE_KEYS,
  PERMISSION_RESOURCES,
  actionForMethod,
  classifyProtectedPath,
  editorPermissionResources,
  applyGrantSelection,
  grantAllows,
  seededGrantForRole,
  withRequiredView,
} from "@/lib/auth/permission-catalog";

const ROOT = path.resolve(__dirname, "../..");
const NON_PAGE_DIRS = new Set(["components", "hooks"]);

describe("permission catalog", () => {
  it("maps time APIs to existing Scheduling grants",()=>{
    for(const path of ["/api/v1/clock-events","/api/v1/clock-ins","/api/v1/timesheets","/api/v1/timesheets/id/approve"]) {
      expect(classifyProtectedPath(path)).toMatchObject({kind:"resource",resourceKey:"scheduling"});
    }
  });
  it("maps worker request list and review routes to Scheduling grants", () => {
    for (const path of ["/api/v1/worker-requests", "/api/v1/worker-requests/id/approve", "/api/v1/worker-requests/id/reject"]) {
      expect(classifyProtectedPath(path)).toMatchObject({ kind: "resource", resourceKey: "scheduling" });
    }
  });
  it("protects the v1 scheduling routes with existing scheduling grants", () => {
    for (const path of ["/api/v1/schedules", "/api/v1/schedules/who-is-off", "/api/v1/tenant-holidays", "/api/v1/shifts", "/api/v1/shifts/shift-id/assignments"]) {
      expect(classifyProtectedPath(path)).toMatchObject({ kind: "resource", resourceKey: "scheduling" });
    }
  });
  it("protects edition administration with company grants and permits feature discovery as a shell read", () => {
    expect(classifyProtectedPath("/api/v1/tenants/me/features").kind).toBe("shell");
    expect(classifyProtectedPath("/api/v1/me/permissions").kind).toBe("shell");
    expect(classifyProtectedPath("/api/v1/departments")).toMatchObject({ kind: "resource", resourceKey: "settings_company" });
    for (const path of [
      "/api/v1/tenants/me/edition",
      "/api/v1/tenants/me/feature-overrides/bill_rates",
      "/api/v1/admin/edition-features",
    ]) {
      expect(classifyProtectedPath(path)).toMatchObject({ kind: "resource", resourceKey: "settings_company" });
    }
  });
  it("keeps dashboard out of the role editor and always granted", () => {
    expect(editorPermissionResources().some((resource) => resource.key === "dashboard")).toBe(false);
    expect(PERMISSION_RESOURCES.find((resource) => resource.key === "dashboard")?.alwaysGranted).toBe(true);
    expect(seededGrantForRole(true, "dashboard")).toBeNull();
  });

  it("maps Launch Pad under the always-granted dashboard module", () => {
    expect(classifyProtectedPath("/admin_recruiter/launch-pad")).toMatchObject({
      kind: "resource",
      resourceKey: "dashboard",
    });
    expect(classifyProtectedPath("/admin_recruiter/launch-pad?step=logo")).toMatchObject({
      kind: "resource",
      resourceKey: "dashboard",
    });
  });

  it("maps legacy admin access to view, edit, and delete, and withholds settings from limited staff", () => {
    expect(seededGrantForRole(true, "settings_company")).toEqual({
      canView: true,
      canEdit: true,
      canDelete: true,
    });
    expect(seededGrantForRole(false, "hiring")).toEqual({
      canView: true,
      canEdit: true,
      canDelete: true,
    });
    expect(seededGrantForRole(false, "settings_company")).toBeNull();
    expect(seededGrantForRole(false, "settings_automation")).toBeNull();
    expect(seededGrantForRole(false, "settings_templates")).toBeNull();
    expect(LIMITED_STAFF_RESOURCE_KEYS).not.toContain("dashboard");
  });

  it("does not let edit grant delete or delete grant edit", () => {
    const grant = { canView: true, canEdit: true, canDelete: false };
    expect(grantAllows(grant, "view")).toBe(true);
    expect(grantAllows(grant, "edit")).toBe(true);
    expect(grantAllows(grant, "delete")).toBe(false);
    expect(grantAllows({ canView: true, canEdit: false, canDelete: true }, "edit")).toBe(false);
    expect(grantAllows(null, "view")).toBe(false);
  });

  it("turns view on with edit or delete, and clears both when view is turned off", () => {
    const none = { canView: false, canEdit: false, canDelete: false };
    expect(applyGrantSelection(none, "canEdit", true)).toEqual({
      canView: true,
      canEdit: true,
      canDelete: false,
    });
    expect(applyGrantSelection(none, "canDelete", true)).toEqual({
      canView: true,
      canEdit: false,
      canDelete: true,
    });
    expect(
      applyGrantSelection({ canView: true, canEdit: true, canDelete: true }, "canView", false)
    ).toEqual(none);
    expect(withRequiredView({ canView: false, canEdit: true, canDelete: false })).toEqual({
      canView: true,
      canEdit: true,
      canDelete: false,
    });
    expect(grantAllows({ canView: false, canEdit: true, canDelete: false }, "view")).toBe(true);
  });

  it("classifies methods into the three supported actions", () => {
    expect(actionForMethod("GET")).toBe("view");
    expect(actionForMethod("HEAD")).toBe("view");
    expect(actionForMethod("POST")).toBe("edit");
    expect(actionForMethod("PUT")).toBe("edit");
    expect(actionForMethod("PATCH")).toBe("edit");
    expect(actionForMethod("DELETE")).toBe("delete");
  });

  it("lets the longer scheduling prefix win over interviews", () => {
    expect(classifyProtectedPath("/admin_recruiter/calendar")).toMatchObject({ resourceKey: "hiring" });
    expect(classifyProtectedPath("/admin_recruiter/calendar/shifts")).toMatchObject({
      resourceKey: "scheduling",
    });
    expect(classifyProtectedPath("/admin_recruiter/dashboard/overview")).toMatchObject({
      resourceKey: "dashboard",
      alwaysGranted: true,
    });
    expect(classifyProtectedPath("/admin_recruiter/dashboard/onboarding-flows")).toMatchObject({
      resourceKey: "settings_automation",
    });
    expect(classifyProtectedPath("/api/admin/header-data")).toEqual({ kind: "shell" });
    expect(classifyProtectedPath("/api/admin/view-as-tenant")).toEqual({ kind: "god_only" });
    expect(classifyProtectedPath("/api/admin/not-a-module")).toEqual({ kind: "unmapped" });
    expect(classifyProtectedPath("/api/admin/clients")).toMatchObject({
      kind: "resource",
      resourceKey: "organization",
    });
    expect(classifyProtectedPath("/admin_recruiter/clients")).toMatchObject({
      kind: "resource",
      resourceKey: "organization",
    });
    expect(classifyProtectedPath("/api/admin/timesheets")).toMatchObject({
      kind: "resource",
      resourceKey: "scheduling",
    });
    expect(classifyProtectedPath("/admin_recruiter/timesheets")).toMatchObject({
      kind: "resource",
      resourceKey: "scheduling",
    });
    expect(classifyProtectedPath("/api/support-tickets")).toMatchObject({
      kind: "resource",
      resourceKey: "settings_help",
      alwaysGranted: true,
    });
    expect(classifyProtectedPath("/api/support-tickets/id/messages")).toMatchObject({
      kind: "resource",
      resourceKey: "settings_help",
      alwaysGranted: true,
    });
    expect(classifyProtectedPath("/admin_recruiter/tickets/support")).toMatchObject({
      kind: "resource",
      resourceKey: "settings_help",
      alwaysGranted: true,
    });
  });

  it("classifies every admin API directory", () => {
    const dirs = readdirSync(path.join(ROOT, "app/api/admin"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs.length).toBeGreaterThan(40);
    for (const dir of dirs) {
      const classified = classifyProtectedPath(`/api/admin/${dir}`);
      expect(classified.kind, dir).not.toBe("unmapped");
    }
  });

  it("classifies every admin page directory", () => {
    const dirs = readdirSync(path.join(ROOT, "app/admin_recruiter"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !NON_PAGE_DIRS.has(entry.name))
      .map((entry) => entry.name);
    for (const dir of dirs) {
      const classified = classifyProtectedPath(`/admin_recruiter/${dir}`);
      expect(classified.kind, dir).toBe("resource");
    }
  });

  it("seeds the same resource keys the migration inserts", () => {
    const sql = require("node:fs").readFileSync(
      path.join(ROOT, "supabase/migrations/20261028010000_role_module_permissions.sql"),
      "utf8"
    );
    for (const resource of PERMISSION_RESOURCES) {
      expect(sql).toContain(`'${resource.key}'`);
    }
    for (const key of LIMITED_STAFF_RESOURCE_KEYS) {
      expect(sql).toContain(`'${key}'`);
    }
    expect(sql).not.toContain("'create'");
    expect(sql).not.toContain("'approve'");
    expect(sql).not.toContain("'manage'");
  });
});
