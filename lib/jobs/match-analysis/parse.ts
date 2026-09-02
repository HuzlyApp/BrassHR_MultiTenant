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
  const knockout = lean.match_category === "NOT_CURRENTLY_SUBMITTABLE" || blocking.length > 0;

  return matchAnalysisResponseSchema.parse({
    analysis_version: "1.0",
    candidate_match: {
      recommended_overall_match_score: lean.recommended_overall_match_score,
      match_category: lean.match_category,
      display_category: MATCH_CATEGORY_LABELS[lean.match_category],
      confidence_score: 0,
      mandatory_requirement_override: knockout,
      recommended_action: lean.recommended_action,
      recruiter_decision_summary: "",
    },
    mandatory_requirements: lean.mandatory_requirements.map((item) =>
      expandLeanRequirement(item, "MANDATORY")
    ),
    preferred_requirements: lean.preferred_requirements.map((item) =>
      expandLeanRequirement(item, "PREFERRED")
    ),
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
  });
}

function looksLikeLeanAnalyzeOutput(obj: Record<string, unknown>): boolean {
  const hasTopLevelCategory = typeof obj.match_category === "string";
  const hasNestedCandidateMatch =
    obj.candidate_match != null && typeof obj.candidate_match === "object";
  return hasTopLevelCategory && !hasNestedCandidateMatch;
}

function coerceLeanAnalyzeShape(obj: Record<string, unknown>): Record<string, unknown> {
  const next = { ...obj };

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
