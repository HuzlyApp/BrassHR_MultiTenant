import { describe, expect, it } from "vitest";
import { buildSubmissionResumeUserPrompt } from "./generate-submission-resume";
import { formatVerifiedInfoForSubmission } from "./submission-enrichment";
import type { MatchAnalysisResponse } from "./schema";

function analysisFixture(): MatchAnalysisResponse {
  return {
    analysis_version: "1.0",
    job: {
      job_id: "job-1",
      job_title: "test",
      msp_or_client: "MSP",
      specialty: "Test professional",
      location: "Illinois City, Illinois",
    },
    candidate_match: {
      recommended_overall_match_score: 94,
      match_category: "STRONG_MATCH",
      display_category: "Strong Match",
      confidence_score: 93,
      mandatory_requirement_override: false,
      recommended_action: "PRIORITIZE_AND_CALL",
      recruiter_decision_summary: "Strong on-site fit for Illinois City.",
    },
    subscores: {
      mandatory_requirements_score: 100,
      specialty_experience_score: 95,
      clinical_skills_score: 90,
      licenses_certifications_score: 88,
      work_setting_equipment_score: 96,
      preferred_qualifications_score: 80,
    },
    experience_analysis: {
      total_professional_experience_years: 8,
      relevant_specialty_experience_years: 7,
      recent_relevant_experience_years: 4,
      travel_experience_confirmed: true,
      required_work_setting_experience_confirmed: true,
      is_estimated: false,
      experience_calculation_notes: ["Lead Test Professional at River Bend Facility."],
    },
    mandatory_requirements: [
      {
        requirement: "Ability to work the assigned on-site schedule in Illinois City, Illinois.",
        requirement_type: "MANDATORY",
        status: "CONFIRMED",
        requirement_outcome: "MET",
        candidate_evidence: "Lives and works on-site in Illinois City.",
        evidence_source: "RESUME",
        impact: "",
        verification_required: false,
        confidence: 96,
      },
    ],
    preferred_requirements: [],
    strengths: ["Local Illinois City availability.", "Eight years of facility testing work."],
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
    quick_match: {
      step: "quick_match",
      quick_route: "STRONG",
      extracted_resume: {
        headline: "Lead Test Professional",
        years_estimated: 8,
        recent_titles: ["Lead Test Professional", "Test Coordinator"],
        named_products_in_jobs: [],
        education: "B.S. Health Sciences, University of Illinois, 2017",
      },
      counts: {
        confirmed: 1,
        partial: 0,
        not_found: 0,
        conflicting: 0,
        preferred_confirmed: 0,
        preferred_total: 0,
      },
      mand_met: 1,
      pref_met: 0,
      weighted: 1,
    },
  };
}

describe("Step 5 submission résumé enrichment", () => {
  it("formats verified information for the draft prompt", () => {
    expect(
      formatVerifiedInfoForSubmission([
        { category: "license", title: "RN", details: "Nursys confirmed" },
        { category: "availability", title: null, details: "Starts Monday" },
        { category: "", title: "", details: "" },
      ])
    ).toBe(
      "Verified information:\n- license · RN: Nursys confirmed\n- availability: Starts Monday"
    );
  });

  it("includes Steps 2–4 enrichment in the draft user prompt", () => {
    const prompt = buildSubmissionResumeUserPrompt({
      identity: {
        fullName: "Maya Ellison",
        email: "maya@example.com",
        phone: "555-0100",
        location: "Illinois City, IL",
        jobTitle: "Test Professional",
      },
      analysis: analysisFixture(),
      resumeText: "Maya Ellison\nRN with Illinois City experience.",
      enrichmentNotes: [
        "Call context:\nOpen to travel.",
        "Screening call answers:\nQ: Earliest start?\nA: Next Monday",
        "Verified information:\n- license · RN: Nursys confirmed",
      ].join("\n\n"),
    });

    expect(prompt).toContain("Recruiter enrichment from Verifications / Follow-Up / Deep Match:");
    expect(prompt).toContain("Call context:\nOpen to travel.");
    expect(prompt).toContain("Q: Earliest start?\nA: Next Monday");
    expect(prompt).toContain("Nursys confirmed");
    expect(prompt).toContain("Confirmed evidence:");
    expect(prompt).toContain("Illinois City");
    expect(prompt).toContain("Original résumé:");
  });

  it("omits the enrichment section when Steps 2–3 are empty", () => {
    const prompt = buildSubmissionResumeUserPrompt({
      identity: {
        fullName: "Maya Ellison",
        email: "",
        phone: "",
        location: "",
        jobTitle: "Test Professional",
      },
      analysis: analysisFixture(),
      resumeText: "Résumé text",
      enrichmentNotes: "   ",
    });

    expect(prompt).not.toContain("Recruiter enrichment");
  });
});
