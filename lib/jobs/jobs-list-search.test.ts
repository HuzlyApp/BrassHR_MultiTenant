import { describe, expect, it } from "vitest";
import {
  buildJobsSearchApplyPayload,
  jobMatchesSkillsFilter,
  jobMatchesTextSearch,
  jobSkillsSearchHaystack,
} from "./jobs-list-search";

describe("buildJobsSearchApplyPayload", () => {
  it("trims query and joins skill tags", () => {
    expect(
      buildJobsSearchApplyPayload({
        query: "  System Engineer  ",
        skillTags: [" BLS ", "", "ACLS"],
      })
    ).toEqual({
      query: "System Engineer",
      skillsFilter: "BLS, ACLS",
    });
  });
});

describe("jobMatchesTextSearch", () => {
  const job = {
    source_type: "MSP",
    public_title: "Fallback Title",
    source_job_title: "CNA Travel",
    location: "Texas City, TX",
    msp_name: "new csp",
    msp_client: "Acme Health",
    professions: { name: "Nursing Assistant" },
  };

  it("returns true when query empty", () => {
    expect(jobMatchesTextSearch(job, "")).toBe(true);
  });

  it("matches title location msp client or profession", () => {
    expect(jobMatchesTextSearch(job, "CNA")).toBe(true);
    expect(jobMatchesTextSearch(job, "texas")).toBe(true);
    expect(jobMatchesTextSearch(job, "new csp")).toBe(true);
    expect(jobMatchesTextSearch(job, "Acme")).toBe(true);
    expect(jobMatchesTextSearch(job, "Nursing")).toBe(true);
    expect(jobMatchesTextSearch(job, "dentist")).toBe(false);
  });
});

describe("jobMatchesSkillsFilter", () => {
  const job = {
    public_title: "ICU Nurse",
    tags: ["Travel", "Night"],
    required_credentials: ["BLS", "ACLS"],
    specialties: { name: "Critical Care" },
    qualifications: "Must have ICU experience and Epic charting",
  };

  it("returns true when no skills filter", () => {
    expect(jobMatchesSkillsFilter(job, "")).toBe(true);
  });

  it("ANDs skill tags against credentials and description", () => {
    expect(jobMatchesSkillsFilter(job, "BLS, ACLS")).toBe(true);
    expect(jobMatchesSkillsFilter(job, "BLS, Epic")).toBe(true);
    expect(jobMatchesSkillsFilter(job, "BLS, PALS")).toBe(false);
  });

  it("matches job tags", () => {
    expect(jobMatchesSkillsFilter(job, "Travel")).toBe(true);
  });
});

describe("jobSkillsSearchHaystack", () => {
  it("includes title specialty and credentials", () => {
    const hay = jobSkillsSearchHaystack({
      public_title: "System Engineer",
      specialties: { name: "IT" },
      required_credentials: ["AWS"],
    });
    expect(hay).toContain("system engineer");
    expect(hay).toContain("it");
    expect(hay).toContain("aws");
  });
});
