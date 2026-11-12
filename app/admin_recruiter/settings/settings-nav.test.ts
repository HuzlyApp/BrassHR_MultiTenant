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
  it("keeps mini-sidebar active for all registered settings and account tabs", () => {
    const testPaths = [
      // Personal Settings
      "/admin_recruiter/account",
      "/admin_recruiter/account/personal",
      "/admin_recruiter/account/account-settings",
      "/admin_recruiter/account/business-info",
      "/admin_recruiter/account/security",

      // App Settings
      "/admin_recruiter/settings",
      "/admin_recruiter/settings/branding",
      "/admin_recruiter/settings/hiring-theme",
      "/admin_recruiter/notifications",
      "/admin_recruiter/settings/call",
      "/admin_recruiter/settings/task",

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
      "/admin_recruiter/settings/assessment",
      "/admin_recruiter/settings/statuses",
      "/admin_recruiter/settings/templates",
      "/admin_recruiter/template-builder",
      "/admin_recruiter/email-templates",

      // Administration
      "/admin_recruiter/settings/admin-console",
      "/admin_recruiter/settings/roles",
      "/admin_recruiter/settings/integrations",

      // Help & Support
      "/admin_recruiter/help-support",

      // Reports
      "/admin_recruiter/reports",
    ];

    for (const path of testPaths) {
      expect(
        isSettingsMiniSidebarPath(path),
        `Mini sidebar should not close for route: ${path}`
      ).toBe(true);
    }
  });

  it("does not trigger mini-sidebar on unrelated main app routes", () => {
    const nonSettingsPaths = [
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

    const securityItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "security"
    );
    expect(securityItem).toBeDefined();
    expect(
      isSettingsNavItemActive(securityItem!, "/admin_recruiter/account/security")
    ).toBe(true);

    const profileItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "profile"
    );
    expect(profileItem).toBeDefined();
    expect(
      isSettingsNavItemActive(profileItem!, "/admin_recruiter/account/personal")
    ).toBe(true);

    const accountItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "account"
    );
    expect(accountItem).toBeDefined();
    expect(
      isSettingsNavItemActive(accountItem!, "/admin_recruiter/account/account-settings")
    ).toBe(true);
    expect(
      isSettingsNavItemActive(accountItem!, "/admin_recruiter/account/business-info")
    ).toBe(true);
    // Profile must not stay active on Account routes (shared /account prefix bug).
    expect(
      isSettingsNavItemActive(profileItem!, "/admin_recruiter/account/account-settings")
    ).toBe(false);
    expect(
      isSettingsNavItemActive(profileItem!, "/admin_recruiter/account/business-info")
    ).toBe(false);
    expect(
      isSettingsNavItemActive(accountItem!, "/admin_recruiter/account/personal")
    ).toBe(false);

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
    ]);
  });

  it("recognizes settings routes where settings icon acts as a main sidebar toggle", () => {
    // When inside settings (roles, branding, security, etc.), clicking settings icon toggles the main rail
    expect(isSettingsMiniSidebarPath("/admin_recruiter/settings/roles")).toBe(true);
    expect(isSettingsMiniSidebarPath("/admin_recruiter/settings/branding")).toBe(true);
    expect(isSettingsMiniSidebarPath("/admin_recruiter/account/security")).toBe(true);
  });

  it("keeps Help & Support and Reports in Settings for every role", () => {
    const limited = visibleSettingsNavGroups(
      SETTINGS_NAV_GROUPS,
      new Set(["settings_profile"])
    );
    const ids = limited.flatMap((group) => group.items.map((item) => item.id));
    expect(ids).toContain("help");
    expect(ids).toContain("reports");
    const helpItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === "help");
    expect(helpItem?.href).toBe("/admin_recruiter/help-support");
    const reportsItem = SETTINGS_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "reports"
    );
    expect(reportsItem?.href).toBe("/admin_recruiter/reports");
    const appGroup = SETTINGS_NAV_GROUPS.find((g) => g.id === "app");
    expect(appGroup?.items.some((item) => item.id === "help")).toBe(true);
  });

  it("opens Settings to branding for admins and a permitted page for recruiters", () => {
    expect(resolveSettingsLandingHref(new Set(["*"]), true)).toBe(SETTINGS_LANDING_HREF);
    expect(
      resolveSettingsLandingHref(
        new Set(["settings_profile", "settings_notifications", "settings_help", "settings_reports"])
      )
    ).toBe("/admin_recruiter/account/personal");
  });
});
