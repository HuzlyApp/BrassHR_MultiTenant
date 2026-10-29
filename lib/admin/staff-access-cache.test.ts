import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { visibleSidebarSections } from "@/lib/auth/sidebar-access";
import { CLIENT_SIDEBAR_SECTIONS } from "@/app/admin_recruiter/components/sidebar-config";
import { sidebarLinkIsActive } from "@/lib/admin/sidebar-nav-state";
import {
  clearStaffAccessCache,
  staffAccessQueryKey,
  writeStaffAccessCache,
  type StaffAccessRecord,
} from "@/lib/admin/staff-access-cache";

const recruiter: StaffAccessRecord = {
  tenantId: "tenant-a",
  godAdmin: false,
  grants: [
    { key: "dashboard", canView: true, canEdit: true, canDelete: true },
    { key: "hiring", canView: true, canEdit: false, canDelete: false },
    { key: "jobs", canView: false, canEdit: false, canDelete: false },
    { key: "mail", canView: false, canEdit: false, canDelete: false },
  ],
  viewKeys: ["dashboard", "hiring"],
};

describe("staff access cache", () => {
  it("keys access by tenant and replaces that tenant immediately", () => {
    const client = new QueryClient();
    writeStaffAccessCache(client, recruiter);
    writeStaffAccessCache(client, {
      ...recruiter,
      tenantId: "tenant-b",
      viewKeys: ["dashboard", "mail"],
    });

    expect(client.getQueryData(staffAccessQueryKey("tenant-a"))).toMatchObject({
      viewKeys: ["dashboard", "hiring"],
    });
    expect(client.getQueryData(staffAccessQueryKey("tenant-b"))).toMatchObject({
      viewKeys: ["dashboard", "mail"],
    });

    clearStaffAccessCache(client);
    expect(client.getQueryData(staffAccessQueryKey("tenant-a"))).toBeUndefined();
    expect(client.getQueryData(staffAccessQueryKey("tenant-b"))).toBeUndefined();
  });

  it("hides resources the role cannot view, including before a fetch returns", () => {
    const visible = visibleSidebarSections(CLIENT_SIDEBAR_SECTIONS, new Set(["dashboard"]), false);
    const labels = visible.map((section) => section.label);
    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("Mail");
    expect(labels).not.toContain("Chat");
    expect(labels).not.toContain("Hiring");
  });

  it("keeps hiring and drops jobs when only hiring is granted", () => {
    const visible = visibleSidebarSections(CLIENT_SIDEBAR_SECTIONS, new Set(recruiter.viewKeys), false);
    const hiring = visible.find((section) => section.label === "Hiring");
    expect(hiring?.children?.map((child) => child.label)).not.toContain("Jobs");
    expect(visible.map((section) => section.label)).not.toContain("Mail");
  });
});

describe("sidebarLinkIsActive", () => {
  it("highlights the clicked href before the pathname changes", () => {
    const link = { href: "/admin_recruiter/jobs", matchPrefixes: ["/admin_recruiter/jobs"] };
    const current = { href: "/admin_recruiter/home", matchPrefixes: ["/admin_recruiter/home"] };
    expect(sidebarLinkIsActive(link, "/admin_recruiter/home", "/admin_recruiter/jobs")).toBe(true);
    expect(sidebarLinkIsActive(current, "/admin_recruiter/home", "/admin_recruiter/jobs")).toBe(false);
    expect(sidebarLinkIsActive(link, "/admin_recruiter/home", null)).toBe(false);
  });

  it("matches nested routes and exact dashboard routes", () => {
    expect(
      sidebarLinkIsActive(
        { href: "/admin_recruiter/jobs", matchPrefixes: ["/admin_recruiter/jobs"] },
        "/admin_recruiter/jobs/123",
        null
      )
    ).toBe(true);
    expect(
      sidebarLinkIsActive(
        {
          href: "/admin_recruiter/home",
          matchPrefixes: ["/admin_recruiter/home"],
          matchExact: true,
        },
        "/admin_recruiter/home/extra",
        null
      )
    ).toBe(false);
  });
});
