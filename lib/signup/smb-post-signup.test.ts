import { describe, expect, it } from "vitest";
import {
  isSmbOwnerSignup,
  isSmbTenantCategory,
  subdomainCandidateFromCompanyName,
  withSubdomainSuffix,
} from "@/lib/signup/smb-post-signup";

describe("smb-post-signup", () => {
  it("detects SMB from staffing flag", () => {
    expect(isSmbOwnerSignup({ isStaffingCompany: false })).toBe(true);
    expect(isSmbOwnerSignup({ isStaffingCompany: true })).toBe(false);
    expect(isSmbOwnerSignup({ isStaffingCompany: null })).toBe(false);
  });

  it("detects SMB category strings", () => {
    expect(isSmbTenantCategory("SMB")).toBe(true);
    expect(isSmbTenantCategory(" smb ")).toBe(true);
    expect(isSmbTenantCategory("Staffing")).toBe(false);
  });

  it("builds a valid subdomain from a company name", () => {
    expect(subdomainCandidateFromCompanyName("Harbor City Dimsum")).toBe("harbor-city-dimsum");
    expect(subdomainCandidateFromCompanyName("A")).toMatch(/^org-/);
  });

  it("appends a numeric suffix for collisions", () => {
    expect(withSubdomainSuffix("harbor-city-dimsum", 1)).toBe("harbor-city-dimsum-2");
  });
});
