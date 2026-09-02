import { STRONG_MATCH_MIN_SCORE } from "./display";
import {
  MATCH_CATEGORY_LABELS,
  type MatchAnalysisResponse,
  type MatchCategory,
  type RecommendedAction,
  type ReadinessStatus,
  type RequirementItem,
  type RequirementOutcome,
  type RequirementStatus,
} from "./schema";

const STATUS_SCORE: Record<RequirementStatus, number | null> = {
  CONFIRMED: 100,
  PARTIAL: 60,
  NOT_FOUND: 30,
  CONFLICTING: 20,
  NOT_APPLICABLE: null,
};

const WEIGHTS = {
  mandatory: 0.45,
  specialty: 0.2,
  clinical: 0.15,
  licenses: 0.1,
  workSetting: 0.05,
  preferred: 0.05,
} as const;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avgStatusScore(items: RequirementItem[]): number | null {
  const scores: number[] = [];
  for (const item of items) {
    const s = STATUS_SCORE[item.status];
    if (s != null) scores.push(s);
  }
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** "Not listed / not found on résumé" is missing information, not a proven inability. */
export function isAbsenceOnlyEvidence(evidence: string): boolean {
  const e = evidence.trim();
  if (!e) return true;
  return /\b(not (found|listed|mentioned|documented|provided|included|shown|present|noted|stated)|no .{0,120}(listed|mentioned|documented|found|shown|provided|in (the )?(résumé|resume)|on (the )?(résumé|resume))|zero documented|does not (appear|mention|list|show|include)|none (listed|mentioned|documented)|no evidence|absence of|(résumé|resume) (does not|doesn't) (list|mention|show|include)|no .{0,80}(experience|license|certification|credential) (documented|listed|mentioned))\b/i.test(
    e
  );
}

/** Explicit contradiction or inability — not merely missing from the résumé. */
export function isExplicitInability(evidence: string): boolean {
  if (isAbsenceOnlyEvidence(evidence)) return false;
  return /\b(unable to|cannot |can't |will not |won't |unwilling|not authorized|not eligible|not willing|refuses to|ineligible|expired|revoked|surrendered)\b/i.test(
    evidence
  );
}

/**
 * Fairness: missing / NOT_FOUND / NOT_MET without clear evidence → VERIFY.
 * Absence ≠ absence of capability.
 */
export function applyFairnessOutcomes(items: RequirementItem[]): RequirementItem[] {
  return items.map((item) => {
    if (item.status === "NOT_APPLICABLE") {
      return { ...item, requirement_outcome: "NOT_APPLICABLE" as RequirementOutcome };
    }
    if (item.status === "CONFLICTING") {
      return {
        ...item,
        requirement_outcome: "CONFLICT" as RequirementOutcome,
        verification_required: true,
      };
    }
    if (item.status === "CONFIRMED") {
      const hasEvidence = Boolean(item.candidate_evidence?.trim());
      if (!hasEvidence) {
        return {
          ...item,
          status: "PARTIAL" as RequirementStatus,
          requirement_outcome: "VERIFY" as RequirementOutcome,
          verification_required: true,
          evidence_source: item.evidence_source === "NONE" ? "NONE" : item.evidence_source,
        };
      }
      return {
        ...item,
        requirement_outcome: "MET" as RequirementOutcome,
        verification_required: item.verification_required,
      };
    }

    const evidence = item.candidate_evidence?.trim() ?? "";
    if (isExplicitInability(evidence)) {
      return {
        ...item,
        requirement_outcome: "NOT_MET" as RequirementOutcome,
        verification_required: true,
      };
    }

    return {
      ...item,
      requirement_outcome: "VERIFY" as RequirementOutcome,
      verification_required: true,
    };
  });
}

function categoryFromScore(score: number): MatchCategory {
  if (score >= STRONG_MATCH_MIN_SCORE) return "STRONG_MATCH";
  if (score >= 75) return "GOOD_MATCH";
  if (score >= 60) return "POSSIBLE_MATCH";
  if (score >= 40) return "WEAK_MATCH";
  return "NOT_A_MATCH";
}

function actionFromCategory(category: MatchCategory): RecommendedAction {
  switch (category) {
    case "STRONG_MATCH":
      return "PRIORITIZE_AND_CALL";
    case "GOOD_MATCH":
      return "CALL_AND_VERIFY";
    case "POSSIBLE_MATCH":
      return "KEEP_AS_POSSIBLE";
    case "WEAK_MATCH":
      return "KEEP_AS_POSSIBLE";
    case "NOT_A_MATCH":
      return "REDIRECT_TO_OTHER_JOB";
    case "NOT_CURRENTLY_SUBMITTABLE":
      return "STOP_FOR_THIS_JOB";
    case "NEEDS_MORE_INFORMATION":
      return "CALL_AND_VERIFY";
    default:
      return "CALL_AND_VERIFY";
  }
}

function readinessFromAnalysis(
  category: MatchCategory,
  mandatory: RequirementItem[],
  analysis: MatchAnalysisResponse
): { ready_to_submit: boolean; readiness_status: ReadinessStatus } {
  if (category === "NOT_CURRENTLY_SUBMITTABLE") {
    return { ready_to_submit: false, readiness_status: "NOT_CURRENTLY_SUBMITTABLE" };
  }
  if (category === "NEEDS_MORE_INFORMATION") {
    return { ready_to_submit: false, readiness_status: "INSUFFICIENT_INFORMATION" };
  }
  const blocking = mandatory.filter((r) => r.requirement_outcome === "NOT_MET");
  if (blocking.length) {
    return { ready_to_submit: false, readiness_status: "NOT_CURRENTLY_SUBMITTABLE" };
  }
  const needsVerify =
    mandatory.some((r) => r.requirement_outcome === "VERIFY" || r.verification_required) ||
    (analysis.submission_readiness.items_to_verify_before_submission?.length ?? 0) > 0;
  if (needsVerify) {
    return { ready_to_submit: false, readiness_status: "VERIFY_BEFORE_SUBMISSION" };
  }
  return { ready_to_submit: true, readiness_status: "READY_TO_SUBMIT" };
}

function looksLikeLicenseOrCert(text: string): boolean {
  return /\b(license|licensure|certification|certified|BLS|ACLS|PALS|NRP|CPR|RN|LPN|CNA|compact)\b/i.test(
    text
  );
}

function looksLikeSpecialty(text: string): boolean {
  return /\b(specialty|specialt(y|ies)|ICU|ER|OR|telemetry|med.?surg|travel|assignment)\b/i.test(
    text
  );
}

function looksLikeWorkSetting(text: string): boolean {
  return /\b(hospital|clinic|SNF|LTC|home\s*health|acute|ambulatory|facility|onsite|on-site|remote)\b/i.test(
    text
  );
}

function applyMandatoryGapCaps(score: number, mandatory: RequirementItem[]): number {
  const notFound = mandatory.filter(
    (r) => r.status === "NOT_FOUND" && r.requirement_outcome !== "NOT_APPLICABLE"
  );
  const blocked = mandatory.filter(
    (r) => r.requirement_outcome === "NOT_MET" || r.requirement_outcome === "CONFLICT"
  );
  let capped = score;
  if (blocked.length > 0 || notFound.length >= 2) {
    capped = Math.min(capped, 45);
  } else if (notFound.length === 1) {
    capped = Math.min(capped, 59);
  }
  return clamp(capped);
}

function confidenceFromRequirements(
  mandatory: RequirementItem[],
  preferred: RequirementItem[],
  fallback: number
): number {
  const items = [...mandatory, ...preferred].filter((r) => r.status !== "NOT_APPLICABLE");
  if (!items.length) return clamp(fallback);
  const avg = items.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / items.length;
  return clamp(avg || fallback);
}

/**
 * Deterministic rescoring. Do not trust model scores as final.
 * Missing résumé evidence is VERIFY (score pressure), not a 0% knockout.
 */
export function rescoreMatchAnalysis(raw: MatchAnalysisResponse): MatchAnalysisResponse {
  const mandatory = applyFairnessOutcomes(
    raw.mandatory_requirements.map((r) => ({ ...r, requirement_type: "MANDATORY" as const }))
  );
  const preferred = applyFairnessOutcomes(
    raw.preferred_requirements.map((r) => ({ ...r, requirement_type: "PREFERRED" as const }))
  );

  const hardKnockouts = mandatory.filter(
    (r) =>
      r.requirement_outcome === "NOT_MET" ||
      (r.status === "CONFLICTING" && r.requirement_outcome === "CONFLICT")
  );

  const completeness = raw.data_quality.resume_completeness;

  const mandatoryScore = avgStatusScore(mandatory) ?? 50;
  const preferredScore = avgStatusScore(preferred) ?? 50;

  const licenseItems = mandatory.filter((r) => looksLikeLicenseOrCert(r.requirement));
  const specialtyItems = mandatory.filter((r) => looksLikeSpecialty(r.requirement));
  const workSettingItems = mandatory.filter((r) => looksLikeWorkSetting(r.requirement));
  const otherMandatory = mandatory.filter(
    (r) =>
      !looksLikeLicenseOrCert(r.requirement) &&
      !looksLikeSpecialty(r.requirement) &&
      !looksLikeWorkSetting(r.requirement)
  );

  // Empty buckets inherit the mandatory average. Defaulting to 0 made most
  // non-clinical (and many clinical) scores collapse toward 0.
  const licensesScore = avgStatusScore(licenseItems) ?? mandatoryScore;
  const specialtyScore = avgStatusScore(specialtyItems) ?? mandatoryScore;
  const workSettingScore = avgStatusScore(workSettingItems) ?? mandatoryScore;
  const clinicalScore = avgStatusScore(otherMandatory) ?? mandatoryScore;

  let overall = clamp(
    mandatoryScore * WEIGHTS.mandatory +
      specialtyScore * WEIGHTS.specialty +
      clinicalScore * WEIGHTS.clinical +
      licensesScore * WEIGHTS.licenses +
      workSettingScore * WEIGHTS.workSetting +
      preferredScore * WEIGHTS.preferred
  );
  overall = applyMandatoryGapCaps(overall, mandatory);

  if (completeness === "LOW" && mandatory.length > 0) {
    const category: MatchCategory = "NEEDS_MORE_INFORMATION";
    const readiness = readinessFromAnalysis(category, mandatory, raw);
    return {
      ...raw,
      mandatory_requirements: mandatory,
      preferred_requirements: preferred,
      candidate_match: {
        ...raw.candidate_match,
        recommended_overall_match_score: overall,
        match_category: category,
        display_category: MATCH_CATEGORY_LABELS[category],
        confidence_score: confidenceFromRequirements(
          mandatory,
          preferred,
          raw.candidate_match.confidence_score
        ),
        mandatory_requirement_override: false,
        recommended_action: "CALL_AND_VERIFY",
        recruiter_decision_summary:
          raw.candidate_match.recruiter_decision_summary ||
          "Résumé completeness is too low for a reliable assessment.",
      },
      subscores: {
        mandatory_requirements_score: clamp(mandatoryScore),
        specialty_experience_score: clamp(specialtyScore),
        clinical_skills_score: clamp(clinicalScore),
        licenses_certifications_score: clamp(licensesScore),
        work_setting_equipment_score: clamp(workSettingScore),
        preferred_qualifications_score: clamp(preferredScore),
      },
      submission_readiness: {
        ...raw.submission_readiness,
        ...readiness,
      },
    };
  }

  let category: MatchCategory = categoryFromScore(overall);
  if (hardKnockouts.length > 0) {
    category = "NOT_CURRENTLY_SUBMITTABLE";
  } else {
    const unverifiedMandatory = mandatory.some(
      (r) =>
        r.requirement_outcome === "VERIFY" ||
        (r.verification_required && r.requirement_outcome !== "MET")
    );
    if (category === "STRONG_MATCH" && unverifiedMandatory) {
      category = "GOOD_MATCH";
    }
  }

  const action = actionFromCategory(category);
  const readiness = readinessFromAnalysis(category, mandatory, raw);

  return {
    ...raw,
    mandatory_requirements: mandatory,
    preferred_requirements: preferred,
    candidate_match: {
      ...raw.candidate_match,
      recommended_overall_match_score: overall,
      match_category: category,
      display_category: MATCH_CATEGORY_LABELS[category],
      confidence_score: confidenceFromRequirements(
        mandatory,
        preferred,
        raw.candidate_match.confidence_score
      ),
      mandatory_requirement_override: hardKnockouts.length > 0,
      recommended_action: action,
    },
    subscores: {
      mandatory_requirements_score: clamp(mandatoryScore),
      specialty_experience_score: clamp(specialtyScore),
      clinical_skills_score: clamp(clinicalScore),
      licenses_certifications_score: clamp(licensesScore),
      work_setting_equipment_score: clamp(workSettingScore),
      preferred_qualifications_score: clamp(preferredScore),
    },
    submission_readiness: {
      ...raw.submission_readiness,
      ...readiness,
      blocking_requirements:
        readiness.readiness_status === "NOT_CURRENTLY_SUBMITTABLE"
          ? mandatory.filter((r) => r.requirement_outcome === "NOT_MET").map((r) => r.requirement)
          : raw.submission_readiness.blocking_requirements,
    },
  };
}
