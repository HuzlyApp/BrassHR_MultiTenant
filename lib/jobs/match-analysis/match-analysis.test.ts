import { describe, expect, it } from "vitest";
import { parseAndValidateMatchAnalysis } from "./parse";
import { applyFairnessOutcomes, rescoreMatchAnalysis } from "./score";
import { sanitizeResumeForMatchAnalysis } from "./sanitize-resume";
import {
  ANALYZE_RESPONSE_SCHEMA,
  ANALYZE_SYSTEM_PROMPT,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  buildMatchAnalysisUserPrompt,
  systemPromptForMode,
} from "./prompts";
import type { MatchAnalysisResponse, RequirementItem } from "./schema";

function baseAnalysis(
  overrides: Partial<MatchAnalysisResponse> = {}
): MatchAnalysisResponse {
  return {
    analysis_version: "1.0",
    job: {
      job_id: "job-1",
      job_title: "ICU RN",
      msp_or_client: "Acme",
      specialty: "ICU",
      location: "TX",
    },
    candidate_match: {
      recommended_overall_match_score: 95,
      match_category: "STRONG_MATCH",
      display_category: "Strong Match",
      confidence_score: 80,
      mandatory_requirement_override: false,
      recommended_action: "PRIORITIZE_AND_CALL",
      recruiter_decision_summary: "Looks strong",
    },
    subscores: {
      mandatory_requirements_score: 95,
      specialty_experience_score: 90,
      clinical_skills_score: 90,
      licenses_certifications_score: 95,
      work_setting_equipment_score: 80,
      preferred_qualifications_score: 70,
    },
    experience_analysis: {
      total_professional_experience_years: 5,
      relevant_specialty_experience_years: 3,
      recent_relevant_experience_years: 2,
      travel_experience_confirmed: true,
      required_work_setting_experience_confirmed: true,
      is_estimated: false,
      experience_calculation_notes: [],
    },
    mandatory_requirements: [],
    preferred_requirements: [],
    strengths: ["ICU experience"],
    gaps_and_risks: [],
    screening_questions: [],
    submission_readiness: {
      ready_to_submit: true,
      readiness_status: "READY_TO_SUBMIT",
      items_to_verify_before_submission: [],
      documents_or_credentials_needed: [],
      blocking_requirements: [],
    },
    alternative_fit: {
      redirect_recommended: false,
      redirect_reason: "",
      possible_job_types: [],
    },
    data_quality: {
      resume_completeness: "HIGH",
      job_description_completeness: "HIGH",
      job_description_conflicts: [],
      resume_conflicts: [],
      missing_information: [],
    },
    ...overrides,
  };
}

function req(
  partial: Partial<RequirementItem> & Pick<RequirementItem, "requirement">
): RequirementItem {
  return {
    requirement_type: "MANDATORY",
    status: "CONFIRMED",
    requirement_outcome: "MET",
    candidate_evidence: "Worked 2 years ICU at Memorial",
    evidence_source: "RESUME",
    impact: "",
    verification_required: false,
    confidence: 90,
    ...partial,
  };
}

describe("parseAndValidateMatchAnalysis", () => {
  it("parses fenced JSON and validates schema", () => {
    const analysis = baseAnalysis({
      mandatory_requirements: [
        req({ requirement: "Active TX RN license" }),
      ],
    });
    const raw = "```json\n" + JSON.stringify(analysis) + "\n```";
    const parsed = parseAndValidateMatchAnalysis(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.mandatory_requirements).toHaveLength(1);
      expect(parsed.data.candidate_match.match_category).toBe("STRONG_MATCH");
    }
  });

  it("returns validation errors for invalid category", () => {
    const bad = {
      ...baseAnalysis(),
      candidate_match: {
        ...baseAnalysis().candidate_match,
        match_category: "SUPER_MATCH",
        recommended_action: "PRIORITIZE_AND_CALL",
      },
    };
    const parsed = parseAndValidateMatchAnalysis(JSON.stringify(bad));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.includes("match_category"))).toBe(true);
    }
  });

  it("hydrates lean Analyze JSON into the full match-analysis shape", () => {
    const lean = {
      recommended_overall_match_score: 68,
      match_category: "POSSIBLE_MATCH",
      recommended_action: "CALL_AND_VERIFY",
      mandatory_requirements: [
        {
          requirement: "Active TX RN license",
          status: "PARTIAL",
          evidence: "Lists RN license without state or expiry.",
        },
        {
          requirement: "2 years ICU",
          status: "CONFIRMED",
          evidence: "ICU RN at Memorial 2022-2024.",
        },
      ],
      preferred_requirements: [
        {
          requirement: "Travel experience",
          status: "NOT_FOUND",
          evidence: "",
        },
      ],
      screening_questions: ["Confirm TX compact license status.", "Verify ICU unit type."],
      items_to_verify: ["Work authorization"],
      blocking_requirements: [],
    };
    const parsed = parseAndValidateMatchAnalysis(JSON.stringify(lean));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.candidate_match.match_category).toBe("POSSIBLE_MATCH");
      expect(parsed.data.candidate_match.recommended_action).toBe("CALL_AND_VERIFY");
      expect(parsed.data.candidate_match.recommended_overall_match_score).toBe(68);
      expect(parsed.data.mandatory_requirements).toHaveLength(2);
      expect(parsed.data.mandatory_requirements[0]?.candidate_evidence).toContain("RN license");
      expect(parsed.data.mandatory_requirements[0]?.requirement_outcome).toBe("VERIFY");
      expect(parsed.data.mandatory_requirements[1]?.requirement_outcome).toBe("MET");
      expect(parsed.data.screening_questions).toHaveLength(2);
      expect(parsed.data.screening_questions[0]?.question).toContain("compact license");
      expect(parsed.data.submission_readiness.items_to_verify_before_submission).toEqual([
        "Work authorization",
      ]);
      expect(parsed.data.strengths).toEqual([]);
      expect(parsed.data.gaps_and_risks).toEqual([]);
    }
  });
});

describe("analyze vs deep prompts", () => {
  const sampleInput = {
    jobId: "job-1",
    jobTitle: "ICU RN",
    structured: {
      mandatoryRequirements: ["Active TX RN license"],
      preferredRequirements: ["Travel experience"],
      requiredLicenses: ["RN"],
      requiredCertifications: ["BLS"],
      educationRequirements: ["BSN"],
    },
    fullJobDescription: "Need an ICU RN in Texas.",
    resumeText: "ICU RN at Memorial 2022-2024.",
  };

  it("defaults to the Analyze prompt and lean JSON schema", () => {
    expect(systemPromptForMode("analyze")).toBe(ANALYZE_SYSTEM_PROMPT);
    expect(systemPromptForMode("deep")).toBe(DEEP_ANALYSIS_SYSTEM_PROMPT);
    const prompt = buildMatchAnalysisUserPrompt(sampleInput);
    expect(prompt).toContain(ANALYZE_RESPONSE_SCHEMA);
    expect(prompt).toContain("no more than 4 focused screening questions");
    expect(prompt).not.toContain("recruiter_decision_summary");
    expect(prompt).not.toContain("experience_calculation_notes");
  });

  it("uses the deep schema only when analysisMode is deep", () => {
    const prompt = buildMatchAnalysisUserPrompt({ ...sampleInput, analysisMode: "deep" });
    expect(prompt).toContain("recruiter_decision_summary");
    expect(prompt).toContain("experience_calculation_notes");
    expect(prompt).toContain("no more than 5 focused screening questions");
  });
});

describe("sanitizeResumeForMatchAnalysis", () => {
  it("redacts SSN, DOB, age, marital status, street address", () => {
    const raw = `
Jane Doe
SSN: 123-45-6789
DOB: 01/02/1990
Age: 34
Marital Status: Married
123 Main Street Apt 4
Austin, TX 78701
ICU RN with 5 years experience
`;
    const sanitized = sanitizeResumeForMatchAnalysis(raw);
    expect(sanitized).not.toMatch(/123-45-6789/);
    expect(sanitized).toContain("[REDACTED_SSN]");
    expect(sanitized).toContain("[REDACTED_DOB]");
    expect(sanitized).toContain("[REDACTED_AGE]");
    expect(sanitized).toContain("[REDACTED_MARITAL_STATUS]");
    expect(sanitized).toContain("[REDACTED_STREET_ADDRESS]");
    expect(sanitized).toContain("ICU RN with 5 years experience");
  });
});

describe("applyFairnessOutcomes", () => {
  it("downgrades CONFIRMED without evidence to VERIFY", () => {
    const [result] = applyFairnessOutcomes([
      req({
        requirement: "BLS",
        status: "CONFIRMED",
        requirement_outcome: "MET",
        candidate_evidence: "",
      }),
    ]);
    expect(result.status).toBe("PARTIAL");
    expect(result.requirement_outcome).toBe("VERIFY");
  });

  it("maps NOT_FOUND without clear negative evidence to VERIFY", () => {
    const [result] = applyFairnessOutcomes([
      req({
        requirement: "Epic charting",
        status: "NOT_FOUND",
        requirement_outcome: "NOT_MET",
        candidate_evidence: "",
      }),
    ]);
    expect(result.requirement_outcome).toBe("VERIFY");
  });

  it("does not treat 'not listed on résumé' as a hard NOT_MET knockout", () => {
    const [result] = applyFairnessOutcomes([
      req({
        requirement: "Active RN license",
        status: "NOT_FOUND",
        requirement_outcome: "NOT_MET",
        candidate_evidence: "No RN license listed; only CNA and BLS shown",
      }),
    ]);
    expect(result.requirement_outcome).toBe("VERIFY");
  });

  it("keeps NOT_MET only for explicit inability", () => {
    const [result] = applyFairnessOutcomes([
      req({
        requirement: "Must work onsite in Plano",
        status: "CONFLICTING",
        requirement_outcome: "NOT_MET",
        candidate_evidence: "Candidate stated they cannot work onsite and are unwilling to relocate.",
      }),
    ]);
    expect(result.requirement_outcome).toBe("CONFLICT");
  });
});

describe("rescoreMatchAnalysis", () => {
  it("does not zero the score when a mandatory item is merely missing from the résumé", () => {
    const analysis = baseAnalysis({
      mandatory_requirements: [
        req({
          requirement: "Active TX RN license",
          status: "NOT_FOUND",
          requirement_outcome: "NOT_MET",
          candidate_evidence: "Candidate has no nursing license listed",
        }),
        req({
          requirement: "2 years ICU experience",
          status: "NOT_FOUND",
          requirement_outcome: "NOT_MET",
          candidate_evidence: "No ICU experience documented in résumé",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.match_category).not.toBe("NOT_CURRENTLY_SUBMITTABLE");
    expect(rescored.candidate_match.recommended_overall_match_score).toBeGreaterThan(0);
    expect(rescored.candidate_match.recommended_overall_match_score).toBeLessThanOrEqual(45);
    expect(rescored.mandatory_requirements.every((r) => r.requirement_outcome === "VERIFY")).toBe(
      true
    );
  });

  it("caps explicit inability as not currently submittable without collapsing to 0%", () => {
    const analysis = baseAnalysis({
      mandatory_requirements: [
        req({
          requirement: "Must work onsite in Dallas",
          status: "CONFLICTING",
          requirement_outcome: "CONFLICT",
          candidate_evidence: "Candidate stated they cannot work onsite.",
        }),
        req({
          requirement: "5 years CNA experience",
          status: "CONFIRMED",
          requirement_outcome: "MET",
          candidate_evidence: "CNA at Chatham Health 2020-current",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.match_category).toBe("NOT_CURRENTLY_SUBMITTABLE");
    expect(rescored.candidate_match.recommended_action).toBe("STOP_FOR_THIS_JOB");
    expect(rescored.candidate_match.mandatory_requirement_override).toBe(true);
    expect(rescored.candidate_match.recommended_overall_match_score).toBeGreaterThan(0);
    expect(rescored.candidate_match.recommended_overall_match_score).toBeLessThanOrEqual(45);
  });

  it("sets NEEDS_MORE_INFORMATION when resume completeness is LOW", () => {
    const analysis = baseAnalysis({
      data_quality: {
        resume_completeness: "LOW",
        job_description_completeness: "HIGH",
        job_description_conflicts: [],
        resume_conflicts: [],
        missing_information: ["employment dates"],
      },
      mandatory_requirements: [
        req({
          requirement: "2 years ICU",
          status: "PARTIAL",
          requirement_outcome: "VERIFY",
          candidate_evidence: "Mentions ICU briefly",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.match_category).toBe("NEEDS_MORE_INFORMATION");
    expect(rescored.candidate_match.recommended_action).toBe("CALL_AND_VERIFY");
    expect(rescored.candidate_match.recommended_overall_match_score).toBeGreaterThan(0);
  });

  it("downgrades STRONG to GOOD when mandatory items need verification", () => {
    const analysis = baseAnalysis({
      mandatory_requirements: [
        req({
          requirement: "Active TX RN license",
          status: "PARTIAL",
          requirement_outcome: "VERIFY",
          candidate_evidence: "Mentions RN role",
          verification_required: true,
        }),
        req({
          requirement: "2 years ICU experience",
          status: "CONFIRMED",
          requirement_outcome: "MET",
          candidate_evidence: "ICU RN 2022-2024 at Memorial",
        }),
      ],
      preferred_requirements: [
        req({
          requirement: "Travel experience",
          requirement_type: "PREFERRED",
          status: "CONFIRMED",
          candidate_evidence: "Two travel assignments",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.match_category).not.toBe("NOT_CURRENTLY_SUBMITTABLE");
    // High scores but unverified mandatory → not STRONG
    if (rescored.candidate_match.recommended_overall_match_score >= 90) {
      expect(rescored.candidate_match.match_category).toBe("GOOD_MATCH");
    } else {
      expect(["GOOD_MATCH", "POSSIBLE_MATCH", "WEAK_MATCH"]).toContain(
        rescored.candidate_match.match_category
      );
    }
  });

  it("does not use model score as final — recomputes from statuses", () => {
    const analysis = baseAnalysis({
      candidate_match: {
        ...baseAnalysis().candidate_match,
        recommended_overall_match_score: 99,
        match_category: "STRONG_MATCH",
      },
      mandatory_requirements: [
        req({
          requirement: "Epic EMR",
          status: "NOT_FOUND",
          requirement_outcome: "VERIFY",
          candidate_evidence: "",
        }),
        req({
          requirement: "BLS",
          status: "NOT_FOUND",
          requirement_outcome: "VERIFY",
          candidate_evidence: "",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.recommended_overall_match_score).toBeLessThan(99);
  });

  it("does not collapse score to 0 when license/specialty buckets are empty", () => {
    const analysis = baseAnalysis({
      subscores: {
        mandatory_requirements_score: 0,
        specialty_experience_score: 0,
        clinical_skills_score: 0,
        licenses_certifications_score: 0,
        work_setting_equipment_score: 0,
        preferred_qualifications_score: 0,
      },
      mandatory_requirements: [
        req({
          requirement: "5 years Microsoft Sentinel administration",
          status: "CONFIRMED",
          requirement_outcome: "MET",
          candidate_evidence: "Sentinel engineer at Contoso 2019-2024",
        }),
      ],
    });
    const rescored = rescoreMatchAnalysis(analysis);
    expect(rescored.candidate_match.recommended_overall_match_score).toBeGreaterThanOrEqual(75);
  });
});
