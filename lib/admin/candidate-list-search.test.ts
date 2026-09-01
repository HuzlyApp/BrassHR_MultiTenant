import { describe, expect, it } from "vitest";
import {
  matchesApplicationListSearch,
  matchesCandidateListSearch,
  resolveApplicationJobCode,
  resolveApplicationJobLocation,
} from "@/lib/admin/candidate-list-search";

describe("matchesCandidateListSearch", () => {
  const row = {
    id: "worker-abc12345",
    name: "Jordan Lee",
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan.lee@clinic.org",
    phone: "+1 (404) 555-0100",
    reference: "ABC1234",
    city: "Dallas",
    state: "TX",
    zip: "75201",
    address: "123 Main St, Dallas, TX",
    role: "RN",
  };

  it("matches by name, email, phone, reference, job role, and location", () => {
    expect(matchesCandidateListSearch(row, "jordan")).toBe(true);
    expect(matchesCandidateListSearch(row, "jordan.lee@clinic.org")).toBe(true);
    expect(matchesCandidateListSearch(row, "4045550100")).toBe(true);
    expect(matchesCandidateListSearch(row, "abc1234")).toBe(true);
    expect(matchesCandidateListSearch(row, "dallas")).toBe(true);
    expect(matchesCandidateListSearch(row, "TX")).toBe(true);
    expect(matchesCandidateListSearch(row, "rn")).toBe(true);
  });

  it("matches job role with punctuation normalized", () => {
    expect(
      matchesCandidateListSearch(
        { ...row, role: "Senior AI-ML Engineer" },
        "ai ml"
      )
    ).toBe(true);
    expect(
      matchesCandidateListSearch(
        {
          ...row,
          role: "N/A",
          applicationSearchText:
            "Mainframe Developer / Engineer - COBOL | CICS | DB2 | z/OS | Westlake, TX",
        },
        "cobol"
      )
    ).toBe(true);
  });

  it("returns true for empty query", () => {
    expect(matchesCandidateListSearch(row, "")).toBe(true);
    expect(matchesCandidateListSearch(row, "   ")).toBe(true);
  });
});

describe("matchesApplicationListSearch", () => {
  const row = {
    id: "app-1",
    job_requisition_id: "job-req-uuid-99",
    applicant_profiles: {
      first_name: "Pat",
      last_name: "Kim",
      email: "pat.kim@clinic.org",
      phone: "469-618-0140",
    },
    job_requisitions: {
      public_title: "Systems Engineer",
      internal_requisition_number: "REQ-7788",
      location: "Austin, TX",
    },
  };

  it("resolves job code and location", () => {
    expect(resolveApplicationJobCode(row)).toBe("REQ-7788");
    expect(resolveApplicationJobLocation(row)).toBe("Austin, TX");
  });

  it("matches by applicant and job fields", () => {
    expect(matchesApplicationListSearch(row, "pat kim")).toBe(true);
    expect(matchesApplicationListSearch(row, "pat.kim@clinic.org")).toBe(true);
    expect(matchesApplicationListSearch(row, "469618")).toBe(true);
    expect(matchesApplicationListSearch(row, "req-7788")).toBe(true);
    expect(matchesApplicationListSearch(row, "austin")).toBe(true);
    expect(matchesApplicationListSearch(row, "systems engineer")).toBe(true);
  });
});
