import { describe, expect, it } from "vitest";
import { isStaffRole } from "@/lib/auth/app-role";
import { portalApiForbidden, portalHomePath, portalPageRedirect } from "@/lib/auth/portal-rbac";

describe("portal RBAC", () => {
  it("keeps candidates and workers out of staff authorization", () => {
    expect(isStaffRole("candidate")).toBe(false);
    expect(isStaffRole("worker")).toBe(false);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("recruiter")).toBe(true);
  });

  it("sends each portal role to its own home", () => {
    expect(portalHomePath("candidate")).toBe("/application/candidate");
    expect(portalHomePath("worker")).toBe("/application/home");
    expect(portalHomePath(null)).toBe("/application/home");
  });

  it("blocks a candidate from the worker portal and a worker from the candidate portal", () => {
    expect(portalPageRedirect("/application/home", "candidate")).toBe("/application/candidate");
    expect(portalPageRedirect("/application/applicant-dashboard/schedule", "candidate")).toBe(
      "/application/candidate"
    );
    expect(portalPageRedirect("/application/candidate/jobs", "worker")).toBe("/application/home");
    expect(portalPageRedirect("/application/profile-review", "candidate")).toBeNull();
    expect(portalPageRedirect("/application/candidate/jobs", "candidate")).toBeNull();
    expect(portalPageRedirect("/application/home", "worker")).toBeNull();
  });

  it("rejects candidate calls to worker operations and allows shared applicant APIs", () => {
    expect(portalApiForbidden("/api/applicant-portal/schedule", "candidate")).toBe(true);
    expect(portalApiForbidden("/api/applicant-portal/attendance", "candidate")).toBe(true);
    expect(portalApiForbidden("/api/applicant-portal/groups/abc/messages", "candidate")).toBe(true);
    expect(portalApiForbidden("/api/applicant-portal/applications", "candidate")).toBe(false);
    expect(portalApiForbidden("/api/applicant-portal/session", "candidate")).toBe(false);
    expect(portalApiForbidden("/api/applicant-portal/schedule", "worker")).toBe(false);
  });
});
