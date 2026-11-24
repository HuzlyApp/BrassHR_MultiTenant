import { describe, expect, it } from "vitest";
import {
  isSettingsMiniSidebarPath,
  isSettingsNavItemActive,
  resolveSettingsLandingHref,
  SETTINGS_LANDING_HREF,
  SETTINGS_NAV_GROUPS,
  visibleSettingsNavGroups,
} from "./settings-nav";

describe("Settings Navigation & Mini-Sidebar Persistence", () => {
  it("keeps mini-sidebar active for app settings routes (not personal account pages)", () => {
    const testPaths = [
      // App Settings
      "/admin_recruiter/settings",
      "/admin_recruiter/settings/company-profile",
      "/admin_recruiter/settings/user-management",
      "/admin_recruiter/settings/billing",
      "/admin_recruiter/settings/branding",
      "/admin_recruiter/settings/hiring-theme",
      "/admin_recruiter/settings/call",
      "/admin_recruiter/settings/task",
      "/admin_recruiter/account/business-info",

      // Workflows (hub tabs + library)
      "/admin_recruiter/dashboard/onboarding-flows",
      "/admin_recruiter/dashboard/workflow-mappings",
      "/admin_recruiter/dashboard/workflowlibrary",
      "/admin_recruiter/dashboard/workflow-builder",
      "/admin_recruiter/dashboard/workflows",
      "/admin_recruiter/dashboard/templates",
      "/admin_recruiter/dashboard/onboarding-builder",

      // Recruitment
      "/admin_recruiter/settings/profession",
      "/admin_recruiter/settings/profession/some-id",
      "/admin_recruiter/settings/assessment",
      "/admin_recruiter/settings/assessment/some-id",
      "/admin_recruiter/settings/statuses",
      "/admin_recruiter/settings/templates",
      "/admin_recruiter/template-builder",
      "/admin_recruiter/email-templates",

      // Administration (roles lives under User Management)
      "/admin_recruiter/settings/admin-console",
      "/admin_recruiter/settings/roles",
      "/admin_recruiter/settings/departments",
    ];

    for (const path of testPaths) {
      expect(
        isSettingsMiniSidebarPath(path),
        `Mini sidebar should not close for route: ${path}`
      ).toBe(true);
    }
  });

  it("does not open mini-sidebar for personal settings or unrelated app routes", () => {
    const nonSettingsPaths = [
      "/admin_recruiter/account",
      "/admin_recruiter/account/personal",
      "/admin_recruiter/account/account-security",
      "/admin_recruiter/account/account-settings",
      "/admin_recruiter/account/security",
      "/admin_recruiter/account/notifications",
      "/admin_recruiter/account/call",
      "/admin_recruiter/help-support",
      "/admin_recruiter/notifications",
      "/admin_recruiter/reports",
      "/admin_recruiter/dashboard/overview",
      "/admin_recruiter/dashboard/home",
      "/admin_recruiter/jobs",
      "/admin_recruiter/applications",
      "/admin_recruiter/workers",
      "/admin_recruiter/managers",
      "/admin_recruiter/calendar/shifts",
    ];

    for (const path of nonSettingsPaths) {
      expect(isSettingsMiniSidebarPath(path)).toBe(false);
    }
  });

  it("correctly identifies active settings nav items", () => {
    const brandingItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "branding"
    );
    expect(brandingItem).toBeDefined();
    expect(
      isSettingsNavItemActive(brandingItem!, "/admin_recruiter/settings/branding")
    ).toBe(true);

    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "profile")
    ).toBe(false);
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "account-security")
    ).toBe(false);
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "notifications")
    ).toBe(false);

    const companyProfileItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "company-profile"
    );
    expect(companyProfileItem).toBeDefined();
    expect(
      isSettingsNavItemActive(
        companyProfileItem!,
        "/admin_recruiter/settings/company-profile"
      )
    ).toBe(true);
    expect(
      isSettingsNavItemActive(companyProfileItem!, "/admin_recruiter/account/business-info")
    ).toBe(true);

    const assessmentItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "assessment"
    );
    expect(assessmentItem).toBeDefined();
    expect(
      isSettingsNavItemActive(assessmentItem!, "/admin_recruiter/settings/assessment")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(
        assessmentItem!,
        "/admin_recruiter/settings/assessment/profession-123"
      )
    ).toBe(true);

    const userManagementItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "user-management"
    );
    expect(userManagementItem).toBeDefined();
    expect(userManagementItem!.label).toBe("User Management");
    expect(
      isSettingsNavItemActive(userManagementItem!, "/admin_recruiter/settings/user-management")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(userManagementItem!, "/admin_recruiter/settings/admin-console")
    ).toBe(true);

    const billingItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "billing"
    );
    expect(billingItem).toBeDefined();
    expect(billingItem!.label).toBe("Billing & Subscription");
    expect(
      isSettingsNavItemActive(billingItem!, "/admin_recruiter/settings/billing")
    ).toBe(true);

    const statusesItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "statuses"
    );
    expect(statusesItem?.label).toBe("Statuses");

    const appGroup = SETTINGS_NAV_GROUPS.find((g) => g.id === "app");
    expect(appGroup?.items.map((item) => item.id)).toEqual([
      "company-profile",
      "user-management",
      "roles",
      "departments",
      "branding",
      "integrations",
      "billing",
    ]);
    expect(appGroup?.items.some((item) => item.id === "call")).toBe(false);
    expect(appGroup?.items.some((item) => item.id === "task")).toBe(false);
    expect(appGroup?.items.some((item) => item.id === "help")).toBe(false);
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "roles")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(userManagementItem!, "/admin_recruiter/settings/roles")
    ).toBe(false);
    const rolesItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === "roles")!;
    expect(rolesItem.label).toBe("Roles & Permissions");
    expect(isSettingsNavItemActive(rolesItem, "/admin_recruiter/settings/roles/new")).toBe(true);

    const templatesItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "templates"
    );
    expect(templatesItem).toBeDefined();
    expect(
      isSettingsNavItemActive(templatesItem!, "/admin_recruiter/settings/templates")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(templatesItem!, "/admin_recruiter/template-builder")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(templatesItem!, "/admin_recruiter/email-templates")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(templatesItem!, "/admin_recruiter/dashboard/templates")
    ).toBe(false);

    const libraryItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "library"
    );
    expect(libraryItem).toBeDefined();
    expect(libraryItem!.href).toBe("/admin_recruiter/dashboard/workflowlibrary");
    expect(
      isSettingsNavItemActive(libraryItem!, "/admin_recruiter/dashboard/workflowlibrary")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(libraryItem!, "/admin_recruiter/dashboard/onboarding-flows")
    ).toBe(false);

    const workflowsItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "workflows"
    );
    expect(workflowsItem).toBeDefined();
    expect(workflowsItem!.href).toBe("/admin_recruiter/dashboard/onboarding-flows");
    expect(
      isSettingsNavItemActive(workflowsItem!, "/admin_recruiter/dashboard/onboarding-flows")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(workflowsItem!, "/admin_recruiter/dashboard/workflow-mappings")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(workflowsItem!, "/admin_recruiter/dashboard/templates")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(workflowsItem!, "/admin_recruiter/dashboard/workflowlibrary")
    ).toBe(false);

    const workflowGroup = SETTINGS_NAV_GROUPS.find((g) => g.id === "workflow");
    expect(workflowGroup?.label).toBe("Workflows");
    expect(workflowGroup?.items.map((item) => item.id)).toEqual([
      "workflows",
      "library",
      "legal-documents",
    ]);

    const legalDocumentsItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "legal-documents"
    );
    expect(legalDocumentsItem).toBeDefined();
    expect(legalDocumentsItem!.href).toBe("/admin_recruiter/legal-documents");
    expect(
      isSettingsNavItemActive(legalDocumentsItem!, "/admin_recruiter/legal-documents")
    ).toBe(true);
  });

  it("recognizes settings routes where settings icon acts as a main sidebar toggle", () => {
    expect(isSettingsMiniSidebarPath("/admin_recruiter/settings/roles")).toBe(true);
    expect(isSettingsMiniSidebarPath("/admin_recruiter/settings/branding")).toBe(true);
    expect(isSettingsMiniSidebarPath("/admin_recruiter/legal-documents")).toBe(true);
    expect(isSettingsMiniSidebarPath("/admin_recruiter/account/security")).toBe(false);
  });

  it("keeps Help & Support and Reports off the Settings mini-sidebar", () => {
    const limited = visibleSettingsNavGroups(
      SETTINGS_NAV_GROUPS,
      new Set(["settings_profile"])
    );
    const ids = limited.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).not.toContain("help");
    expect(ids).not.toContain("reports");
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "help")
    ).toBe(false);
    expect(
      SETTINGS_NAV_GROUPS.flatMap((g) => g.items).some((item) => item.id === "reports")
    ).toBe(false);
    const appGroup = SETTINGS_NAV_GROUPS.find((g) => g.id === "app");
    expect(appGroup?.items.some((item) => item.id === "departments")).toBe(true);
  });

  it("opens Settings to branding for admins and falls back when no Settings pages are permitted", () => {
    expect(resolveSettingsLandingHref(new Set(["*"]), true)).toBe(SETTINGS_LANDING_HREF);
    expect(
      resolveSettingsLandingHref(
        new Set(["settings_profile", "settings_notifications", "settings_help", "settings_reports"])
      )
    ).toBe("/admin_recruiter/help-support");
  });
});
