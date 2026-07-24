import { describe, expect, it } from "vitest";
import {
  buildApplyPath,
  buildJobsPortalPath,
  isJobRequisitionOpen,
  normalizeJobToken,
  NO_OPEN_POSITIONS_MESSAGE,
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

  it("routes multiple open jobs to the jobs portal", () => {
    const route = resolveApplicationEntryRoute("acme", [
      { publicJobToken: "job-a" },
      { publicJobToken: "job-b" },
    ]);
    expect(route).toEqual({
      kind: "jobs",
      tenantSlug: "acme",
      path: buildJobsPortalPath("acme"),
    });
  });

  it("routes a single open job to the jobs portal", () => {
    const route = resolveApplicationEntryRoute("acme", [{ publicJobToken: "only-job" }]);
    expect(route).toEqual({
      kind: "jobs",
      tenantSlug: "acme",
      path: buildJobsPortalPath("acme"),
    });
  });

  it("shows the empty state when no open jobs exist", () => {
    const route = resolveApplicationEntryRoute("acme", []);
    expect(route.kind).toBe("empty");
    expect(route).toMatchObject({
      tenantSlug: "acme",
      path: buildJobsPortalPath("acme"),
      message: NO_OPEN_POSITIONS_MESSAGE,
    });
  });

  it("preserves the selected job token in apply URLs", () => {
    expect(buildApplyPath("acme", "abc-123")).toBe("/apply?tenant=acme&job_token=abc-123");
  });

  it("ignores invalid job tokens when building apply URLs", () => {
    expect(buildApplyPath("acme", "null")).toBe("/jobs?tenant=acme");
  });

  it("treats literal null tokens as missing when resolving entry routes", () => {
    const route = resolveApplicationEntryRoute("acme", [{ publicJobToken: "null" }]);
    expect(route.kind).toBe("empty");
  });
});
