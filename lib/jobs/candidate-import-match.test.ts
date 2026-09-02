import { describe, expect, it } from "vitest";
import {
  IMPORT_RECOMMENDED_MIN_SCORE,
  buildImportResultMessage,
  detectDiscoveryTags,
  experienceBucketMatch,
  extractYearsExperience,
  isImportCandidateUuid,
  jobProfileFromWorkspace,
  normalizeImportCandidateIds,
  parseImportSearchParams,
  phrasePresent,
  scoreCandidateAgainstJob,
  tokenize,
} from "./candidate-import-match";

const ICU_JOB = jobProfileFromWorkspace({
  public_title: "ICU Travel RN",
  public_description: "ICU registered nurse for a hospital unit. BLS ACLS required. Remote interviews.",
  qualifications: "BLS\nACLS\nICU experience",
  responsibilities: "Provide ICU nursing care",
  special_requirements: null,
  required_credentials: ["BLS", "ACLS"],
  years_of_experience: "2 years",
  location: "Dallas, TX",
  specialty: "ICU",
  specialties: { name: "ICU" },
  professions: { name: "Nursing" },
  structured_requirements: {
    mandatoryRequirements: ["BLS", "ACLS", "ICU experience"],
    preferredRequirements: ["CCRN", "travel experience"],
    requiredLicenses: ["RN license"],
    requiredCertifications: ["BLS", "ACLS"],
    educationRequirements: ["BSN"],
    requiredYearsExperience: "2 years",
    specialty: "ICU",
    location: "Dallas, TX",
  },
});

describe("candidate import match scorer", () => {
  it("treats OR as a word or operating room, not a substring", () => {
    expect(phrasePresent("operating room circulating nurse", "OR")).toBe(true);
    expect(phrasePresent("travel or contract icu", "OR")).toBe(true);
    expect(phrasePresent("north texas orthopedic clinic", "OR")).toBe(false);
  });

  it("requires every token when the phrase is shorter than 4 characters", () => {
    expect(phrasePresent("rn icu dallas", "RN")).toBe(true);
    expect(phrasePresent("icu dallas", "RN")).toBe(false);
  });

  it("extracts years from résumé text and caps at 50", () => {
    expect(extractYearsExperience("8 years ICU and 12 yrs travel")).toBe(12);
    expect(extractYearsExperience("99 years legendary")).toBe(50);
    expect(extractYearsExperience("no dates", { license_information: "3 years compact RN" })).toBe(3);
  });

  it("scores a strong ICU nurse highly with required-skill reasons", () => {
    const match = scoreCandidateAgainstJob(ICU_JOB, {
      fullName: "Jordan Lee",
      specialty: "ICU",
      location: "Dallas, TX",
      currentRole: "ICU Travel RN",
      previousTitles: ["Med-Surg RN"],
      resumeText:
        "Jordan Lee\nICU Travel RN\n8 years ICU nursing in Dallas, TX\nBLS ACLS CCRN RN license BSN\nTravel assignments in telemetry and emergency.",
      notes: "Strong ICU traveler",
    });

    expect(match.score).toBeGreaterThanOrEqual(80);
    expect(["strong", "excellent"]).toContain(match.band);
    expect(match.reasons.some((reason) => /required skills matched/i.test(reason))).toBe(true);
    expect(match.reasons.some((reason) => /ICU background/i.test(reason))).toBe(true);
    expect(match.matchedSkills.length).toBeGreaterThan(0);
  });

  it("gives empty job title half credit and does not invent AI scores", () => {
    const match = scoreCandidateAgainstJob(
      { ...ICU_JOB, title: "", requiredSkills: [], preferredSkills: [], minYears: null },
      {
        fullName: "Alex Kim",
        specialty: "Product Management",
        resumeText: "SaaS B2B roadmap stakeholder leadership",
      }
    );
    expect(match.score).toBeGreaterThanOrEqual(0);
    expect(match.score).toBeLessThanOrEqual(100);
    expect(match.reasons.join(" ")).not.toMatch(/recommended_overall_match_score/i);
  });

  it("drops unknown years when an experience bucket is set", () => {
    expect(experienceBucketMatch(null, "5to10")).toBe(false);
    expect(experienceBucketMatch(6, "5to10")).toBe(true);
    expect(experienceBucketMatch(2, "under3")).toBe(true);
    expect(experienceBucketMatch(10, "10plus")).toBe(true);
  });

  it("builds job tags from specialty and discovery phrases", () => {
    expect(ICU_JOB.tags).toEqual(expect.arrayContaining(["ICU"]));
    expect(detectDiscoveryTags("icu travel nursing remote")).toEqual(
      expect.arrayContaining(["Remote", "Nursing", "Travel", "ICU"])
    );
    expect(tokenize("The required years of ICU experience")).toEqual(["icu"]);
  });
});

describe("candidate import search params", () => {
  it("defaults recommended tab and minMatch 60", () => {
    const params = parseImportSearchParams(new URLSearchParams("q=lee"));
    expect(params.tab).toBe("recommended");
    expect(params.minMatch).toBe(IMPORT_RECOMMENDED_MIN_SCORE);
    expect(params.q).toBe("lee");
    expect(params.pageSize).toBe(25);
  });

  it("treats anything other than all as recommended and accepts search alias", () => {
    const params = parseImportSearchParams(new URLSearchParams("tab=other&search=dallas&pageSize=99"));
    expect(params.tab).toBe("recommended");
    expect(params.q).toBe("dallas");
    expect(params.pageSize).toBe(50);
  });

  it("defaults all-tab minMatch to 0", () => {
    const params = parseImportSearchParams(new URLSearchParams("tab=all"));
    expect(params.tab).toBe("all");
    expect(params.minMatch).toBe(0);
  });
});

describe("candidate import identifiers", () => {
  it("rejects names and non-uuid ids", () => {
    expect(isImportCandidateUuid("John Smith")).toBe(false);
    expect(isImportCandidateUuid("1234")).toBe(false);
    expect(normalizeImportCandidateIds(["John Smith"]).invalid).toBe(true);
    expect(normalizeImportCandidateIds(["1234"]).invalid).toBe(true);
    expect(normalizeImportCandidateIds("not-an-array").invalid).toBe(true);
  });

  it("dedupes valid UUIDs and flags empty or oversized batches", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(normalizeImportCandidateIds([id, id]).ids).toEqual([id]);
    expect(normalizeImportCandidateIds([]).empty).toBe(true);
    const tooMany = Array.from({ length: 51 }, (_, index) =>
      `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`
    );
    expect(normalizeImportCandidateIds(tooMany).tooMany).toBe(true);
  });

  it("builds import success messages", () => {
    expect(buildImportResultMessage(1, 0)).toBe("1 candidate successfully added.");
    expect(buildImportResultMessage(3, 0)).toBe("3 candidates successfully added.");
    expect(buildImportResultMessage(2, 1)).toBe(
      "2 candidates added. 1 candidate skipped because they already belong to this job."
    );
  });
});
