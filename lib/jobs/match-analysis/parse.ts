import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";
import {
  MATCH_CATEGORY_LABELS,
  analyzeMatchResponseSchema,
  matchAnalysisResponseSchema,
  type AnalyzeMatchResponse,
  type MatchAnalysisResponse,
  type RequirementItem,
  type RequirementOutcome,
  type RequirementStatus,
} from "./schema";
import type { z } from "zod";

export type ParseMatchAnalysisResult =
  | { ok: true; data: MatchAnalysisResponse; rawObject: Record<string, unknown> }
  | { ok: false; errors: string[]; rawText: string; rawObject: Record<string, unknown> | null };

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.map(String).join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

function outcomeFromStatus(status: RequirementStatus): RequirementOutcome {
  switch (status) {
    case "CONFIRMED":
      return "MET";
    case "CONFLICTING":
      return "CONFLICT";
    case "NOT_APPLICABLE":
      return "NOT_APPLICABLE";
    case "PARTIAL":
    case "NOT_FOUND":
    default:
      return "VERIFY";
  }
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (typeof record.text === "string") return record.text.trim();
        if (typeof record.item === "string") return record.item.trim();
        if (typeof record.question === "string") return record.question.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function asScreeningQuestionStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof (item as { question?: unknown }).question === "string") {
        return String((item as { question: string }).question).trim();
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 4);
}

function expandLeanRequirement(
  item: AnalyzeMatchResponse["mandatory_requirements"][number],
  requirementType: RequirementItem["requirement_type"]
): RequirementItem {
  const evidence = item.evidence?.trim() ?? "";
  return {
    requirement: item.requirement,
    requirement_type: requirementType,
    status: item.status,
    requirement_outcome: outcomeFromStatus(item.status),
    candidate_evidence: evidence,
    evidence_source: evidence ? "RESUME" : "NONE",
    impact: "",
    verification_required: item.status !== "CONFIRMED" && item.status !== "NOT_APPLICABLE",
    confidence: item.status === "CONFIRMED" ? 80 : item.status === "PARTIAL" ? 50 : 20,
  };
}

export function expandAnalyzeMatchToFull(lean: AnalyzeMatchResponse): MatchAnalysisResponse {
  const blocking = lean.blocking_requirements.filter(Boolean);
  const itemsToVerify = lean.items_to_verify.filter(Boolean);
  const knockout =
    lean.hard_knockout === true ||
    lean.match_category === "NOT_CURRENTLY_SUBMITTABLE" ||
    blocking.length > 0;
  const strengths = lean.strengths.map((item) => item.trim()).filter(Boolean).slice(0, 5);
  const confirmedStrengths = [...lean.mandatory_requirements, ...lean.preferred_requirements]
    .filter((item) => item.status === "CONFIRMED")
    .map((item) => item.evidence.trim() || item.requirement.trim())
    .filter(Boolean)
    .slice(0, 5);
  const gaps = lean.gaps_and_risks.map((item) => item.trim()).filter(Boolean).slice(0, 5);
  const authenticity = lean.resume_authenticity.trim();
  const potential =
    lean.potential_score_after_verification != null &&
    lean.potential_score_after_verification !== lean.recommended_overall_match_score
      ? `Potential score after verification: ${lean.potential_score_after_verification}.`
      : "";
  const summary = [authenticity ? `Resume authenticity: ${authenticity}` : "", potential]
    .filter(Boolean)
    .join(" ");

  return matchAnalysisResponseSchema.parse({
    analysis_version: "1.0",
    candidate_match: {
      recommended_overall_match_score: lean.recommended_overall_match_score,
      match_category: lean.match_category,
      display_category: lean.display_category.trim() || MATCH_CATEGORY_LABELS[lean.match_category],
      confidence_score: 0,
      mandatory_requirement_override: knockout,
      recommended_action: lean.recommended_action,
      recruiter_decision_summary: summary,
    },
    mandatory_requirements: lean.mandatory_requirements.map((item) =>
      expandLeanRequirement(item, "MANDATORY")
    ),
    preferred_requirements: lean.preferred_requirements.map((item) =>
      expandLeanRequirement(item, "PREFERRED")
    ),
    strengths: strengths.length ? strengths : confirmedStrengths,
    gaps_and_risks: gaps,
    screening_questions: lean.screening_questions
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, 4)
      .map((question, index) => ({
        priority: index + 1,
        question,
        reason: "",
        related_requirement: "",
      })),
    submission_readiness: {
      ready_to_submit: !knockout && itemsToVerify.length === 0,
      readiness_status: knockout
        ? "NOT_CURRENTLY_SUBMITTABLE"
        : itemsToVerify.length
          ? "VERIFY_BEFORE_SUBMISSION"
          : "READY_TO_SUBMIT",
      items_to_verify_before_submission: itemsToVerify,
      documents_or_credentials_needed: [],
      blocking_requirements: blocking,
    },
    data_quality: authenticity
      ? {
          resume_completeness: "MODERATE",
          job_description_completeness: "MODERATE",
          job_description_conflicts: [],
          resume_conflicts: [authenticity],
          missing_information: [],
        }
      : undefined,
  });
}

function looksLikeLeanAnalyzeOutput(obj: Record<string, unknown>): boolean {
  const hasNestedCandidateMatch =
    obj.candidate_match != null && typeof obj.candidate_match === "object";
  if (hasNestedCandidateMatch) return false;
  return (
    typeof obj.match_category === "string" ||
    typeof obj.match_score === "number" ||
    typeof obj.recommendation === "string" ||
    typeof obj.recommended_overall_match_score === "number"
  );
}

function mapRecommendationLabel(value: unknown): {
  category?: string;
  action?: string;
  display?: string;
} {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (raw === "strong submit") {
    return { category: "STRONG_MATCH", action: "PRIORITIZE_AND_CALL", display: "Strong Submit" };
  }
  if (raw === "submit") {
    return { category: "GOOD_MATCH", action: "CALL_AND_VERIFY", display: "Submit" };
  }
  if (raw === "submit after verification") {
    return { category: "POSSIBLE_MATCH", action: "CALL_AND_VERIFY", display: "Submit After Verification" };
  }
  if (raw === "hold") {
    return { category: "WEAK_MATCH", action: "KEEP_AS_POSSIBLE", display: "Hold" };
  }
  if (raw === "do not submit") {
    return {
      category: "NOT_CURRENTLY_SUBMITTABLE",
      action: "STOP_FOR_THIS_JOB",
      display: "Do Not Submit",
    };
  }
  return {};
}

function coerceLeanAnalyzeShape(obj: Record<string, unknown>): Record<string, unknown> {
  const next = { ...obj };

  if (typeof next.recommended_overall_match_score !== "number" && typeof next.match_score === "number") {
    next.recommended_overall_match_score = next.match_score;
  }

  const mapped = mapRecommendationLabel(next.recommendation ?? next.display_category);
  if (!next.match_category && mapped.category) next.match_category = mapped.category;
  if (!next.recommended_action && mapped.action) next.recommended_action = mapped.action;
  if (typeof next.display_category !== "string" || !String(next.display_category).trim()) {
    next.display_category = mapped.display ?? "";
  }

  if (next.hard_knockout === true) {
    next.match_category = "NOT_CURRENTLY_SUBMITTABLE";
    next.recommended_action = "STOP_FOR_THIS_JOB";
    if (!String(next.display_category ?? "").trim()) next.display_category = "Do Not Submit";
  }

  if (!Array.isArray(next.gaps_and_risks) && Array.isArray(next.weaknesses)) {
    next.gaps_and_risks = next.weaknesses;
  }
  if (!Array.isArray(next.screening_questions) && Array.isArray(next.recruiter_questions)) {
    next.screening_questions = next.recruiter_questions;
  }

  const mapRequirements = (value: unknown) => {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = item as Record<string, unknown>;
      const evidence =
        typeof row.evidence === "string"
          ? row.evidence
          : typeof row.candidate_evidence === "string"
            ? row.candidate_evidence
            : "";
      return {
        requirement: row.requirement,
        status: row.status,
        evidence,
      };
    });
  };

  next.mandatory_requirements = mapRequirements(next.mandatory_requirements);
  next.preferred_requirements = mapRequirements(next.preferred_requirements);
  next.strengths = asStringList(next.strengths).slice(0, 5);
  next.gaps_and_risks = asStringList(next.gaps_and_risks).slice(0, 5);
  if (typeof next.resume_authenticity !== "string") {
    next.resume_authenticity = "";
  } else {
    next.resume_authenticity = next.resume_authenticity.trim();
  }
  next.screening_questions = asScreeningQuestionStrings(next.screening_questions);
  next.items_to_verify = asStringList(next.items_to_verify);
  next.blocking_requirements = asStringList(next.blocking_requirements);
  return next;
}

/**
 * Strip markdown fences if present, parse JSON, validate with strict schema.
 * Accepts lean Analyze JSON and expands it to MatchAnalysisResponse.
 */
export function parseAndValidateMatchAnalysis(rawText: string): ParseMatchAnalysisResult {
  const rawObject = extractJsonObjectFromModelText(rawText);
  if (!rawObject) {
    return {
      ok: false,
      errors: ["Could not extract a JSON object from model output."],
      rawText,
      rawObject: null,
    };
  }

  if (looksLikeLeanAnalyzeOutput(rawObject)) {
    const coerced = coerceLeanAnalyzeShape(rawObject);
    const leanParsed = analyzeMatchResponseSchema.safeParse(coerced);
    if (!leanParsed.success) {
      return {
        ok: false,
        errors: formatZodErrors(leanParsed.error),
        rawText,
        rawObject,
      };
    }
    return { ok: true, data: expandAnalyzeMatchToFull(leanParsed.data), rawObject };
  }

  // Coerce requirement_type if model omitted it based on array membership
  const normalized = { ...rawObject } as Record<string, unknown>;
  if (Array.isArray(normalized.mandatory_requirements)) {
    normalized.mandatory_requirements = normalized.mandatory_requirements.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = item as Record<string, unknown>;
      const evidence =
        typeof row.candidate_evidence === "string"
          ? row.candidate_evidence
          : typeof row.evidence === "string"
            ? row.evidence
            : "";
      return {
        requirement_type: "MANDATORY",
        ...row,
        candidate_evidence: evidence,
      };
    });
  }
  if (Array.isArray(normalized.preferred_requirements)) {
    normalized.preferred_requirements = normalized.preferred_requirements.map((item) => {
      if (!item || typeof item !== "object") return item;
      const row = item as Record<string, unknown>;
      const evidence =
        typeof row.candidate_evidence === "string"
          ? row.candidate_evidence
          : typeof row.evidence === "string"
            ? row.evidence
            : "";
      return {
        requirement_type: "PREFERRED",
        ...row,
        candidate_evidence: evidence,
      };
    });
  }

  const parsed = matchAnalysisResponseSchema.safeParse(normalized);
  if (!parsed.success) {
    return {
      ok: false,
      errors: formatZodErrors(parsed.error),
      rawText,
      rawObject,
    };
  }

  return { ok: true, data: parsed.data, rawObject };
}
