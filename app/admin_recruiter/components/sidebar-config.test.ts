import { describe, expect, it } from "vitest";
import {
  CLIENT_SIDEBAR_SECTIONS,
  GOD_ADMIN_SIDEBAR_SECTIONS,
} from "@/app/admin_recruiter/components/sidebar-config";

function flattenLabels(sections: typeof CLIENT_SIDEBAR_SECTIONS) {
  return sections.flatMap((section) => [
    section.label,
    ...(section.children ?? []).map((child) => child.label),
  ]);
}

function flattenHrefs(sections: typeof CLIENT_SIDEBAR_SECTIONS) {
  return sections.flatMap((section) => [
    section.href,
    ...(section.children ?? []).map((child) => child.href),
  ]);
}

describe("admin sidebar job/workflow navigation", () => {
  it("exposes Job Requisitions under Recruitment for client users", () => {
    const labels = flattenLabels(CLIENT_SIDEBAR_SECTIONS);
    const hrefs = flattenHrefs(CLIENT_SIDEBAR_SECTIONS);
    expect(labels).toContain("Job Requisitions");
    expect(hrefs).toContain("/admin_recruiter/jobs");
  });

  it("exposes Workflow Configuration under Settings for client users", () => {
    const labels = flattenLabels(CLIENT_SIDEBAR_SECTIONS);
    const hrefs = flattenHrefs(CLIENT_SIDEBAR_SECTIONS);
    expect(labels).toContain("Workflow Configuration");
    expect(hrefs).toContain("/admin_recruiter/settings/workflow-configuration");
  });

  it("exposes the same nav items for god-admin sidebar", () => {
    const labels = flattenLabels(GOD_ADMIN_SIDEBAR_SECTIONS);
    const hrefs = flattenHrefs(GOD_ADMIN_SIDEBAR_SECTIONS);
    expect(labels).toContain("Job Requisitions");
    expect(labels).toContain("Workflow Configuration");
    expect(hrefs).toContain("/admin_recruiter/jobs");
    expect(hrefs).toContain("/admin_recruiter/settings/workflow-configuration");
  });
});
