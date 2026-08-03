import { describe, expect, it } from "vitest";
import {
  APPLICANT_ENTRY_CTA_START_APPLICATION,
  APPLICANT_ENTRY_CTA_VIEW_POSITIONS,
  buildApplyPath,
  buildDirectOnboardingPath,
  buildJobsPortalPath,
  isJobRequisitionOpen,
  normalizeJobToken,
  resolveApplicationEntryRoute,
} from "@/lib/jobs/public-application-routing";

describe("public application routing", () => {
  it("normalizes invalid job tokens", () => {
    expect(normalizeJobToken(" abc ")).toBe("abc");
    expect(normalizeJobToken("null")).toBeNull();
    expect(normalizeJobToken("undefined")).toBeNull();
    expect(normalizeJobToken("")).toBeNull();
  });

  it("treats jobs without deadlines as open", () => {
    expect(isJobRequisitionOpen({ application_deadline: null })).toBe(true);
    expect(isJobRequisitionOpen({ application_deadline: "" })).toBe(true);
  });

  it("closes jobs after the application deadline", () => {
    expect(
      isJobRequisitionOpen({ application_deadline: "2026-01-01" }, new Date("2026-07-20T12:00:00Z"))
    ).toBe(false);
    expect(
      isJobRequisitionOpen({ application_deadline: "2026-12-31" }, new Date("2026-07-20T12:00:00Z"))
    ).toBe(true);
  });

  it("routes open jobs to the jobs portal with View positions CTA", () => {
    const route = resolveApplicationEntryRoute("acme", [
      { publicJobToken: "job-a" },
      { publicJobToken: "job-b" },
    ]);
    expect(route).toEqual({
      kind: "jobs",
      tenantSlug: "acme",
      path: buildJobsPortalPath("acme"),
      ctaLabel: APPLICANT_ENTRY_CTA_VIEW_POSITIONS,
    });
  });

  it("routes a single open job to the jobs portal", () => {
    const route = resolveApplicationEntryRoute("acme", [{ publicJobToken: "only-job" }]);
    expect(route).toEqual({
      kind: "jobs",
      tenantSlug: "acme",
      path: buildJobsPortalPath("acme"),
      ctaLabel: APPLICANT_ENTRY_CTA_VIEW_POSITIONS,
    });
  });

  it("starts direct Worker Onboarding when no open jobs exist", () => {
    const route = resolveApplicationEntryRoute("acme", []);
    expect(route).toEqual({
      kind: "onboarding",
      tenantSlug: "acme",
      path: buildDirectOnboardingPath("acme"),
      ctaLabel: APPLICANT_ENTRY_CTA_START_APPLICATION,
    });
    expect(route.path).toBe("/application/add-resume?tenant=acme");
    expect(route.path).not.toContain("job_token");
  });

  it("preserves the selected job token in apply URLs", () => {
    expect(buildApplyPath("acme", "abc-123")).toBe("/apply?tenant=acme&job_token=abc-123");
  });

  it("ignores invalid job tokens when building apply URLs", () => {
    expect(buildApplyPath("acme", "null")).toBe("/jobs?tenant=acme");
  });

  it("treats literal null tokens as missing when resolving entry routes", () => {
    const route = resolveApplicationEntryRoute("acme", [{ publicJobToken: "null" }]);
    expect(route.kind).toBe("onboarding");
  });
});
