import { describe, expect, it } from "vitest";
import {
  adminHeaderSearchShortcuts,
  candidatesResultsHref,
  searchAdminHeaderPages,
} from "@/lib/admin/admin-header-search";

describe("admin header search", () => {
  it("returns featured pages when the query is empty", () => {
    const pages = searchAdminHeaderPages("", 5);
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.some((item) => item.href.includes("/admin_recruiter/"))).toBe(true);
  });

  it("matches jobs and candidates pages by keyword", () => {
    const jobs = searchAdminHeaderPages("jobs");
    expect(jobs.some((item) => /job/i.test(item.label) || item.href.includes("/jobs"))).toBe(true);

    const candidates = searchAdminHeaderPages("candidate");
    expect(
      candidates.some(
        (item) => /candidate|applicant/i.test(item.label) || item.href.includes("/candidates")
      )
    ).toBe(true);
  });

  it("builds enter/navigation shortcuts for a typed query", () => {
    const shortcuts = adminHeaderSearchShortcuts("Shivangi");
    expect(shortcuts[0]?.href).toContain("/admin_recruiter/candidates");
    expect(shortcuts[0]?.href).toContain("q=Shivangi");
    expect(shortcuts.some((item) => item.href.includes("/admin_recruiter/jobs?q="))).toBe(true);
    expect(candidatesResultsHref("Midwife")).toContain("q=Midwife");
  });
});
