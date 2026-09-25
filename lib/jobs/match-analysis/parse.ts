import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";
import {
  EVIDENCE_SOURCES,
  MATCH_CATEGORY_LABELS,
  REQUIREMENT_OUTCOMES,
  REQUIREMENT_STATUSES,
  analyzeMatchResponseSchema,
  matchAnalysisResponseSchema,
  quickMatchResponseSchema,
  type AnalyzeMatchResponse,
  type EvidenceSource,
  type MatchAnalysisResponse,
  type QuickEvidenceSource,
  type QuickMatchResponse,
  type QuickRoute,
  type RequirementItem,
  type RequirementOutcome,
  type RequirementStatus,
} from "./schema";
import { recomputeQuickMatchMetrics } from "./quick-route";
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

function mapQuickEvidenceSource(source: QuickEvidenceSource | undefined): EvidenceSource {
  if (source === "RECRUITER_NOTE") return "RECRUITER_NOTE";
  if (source === "NONE" || !source) return "NONE";
  return "RESUME";
}

function quickOutcomeFromStatus(status: RequirementStatus): RequirementOutcome {
  switch (status) {
    case "CONFIRMED":
      return "MET";
    case "PARTIAL":
      return "VERIFY";
    case "NOT_FOUND":
      return "NOT_MET";
    case "CONFLICTING":
      return "CONFLICT";
    case "NOT_APPLICABLE":
    default:
      return "NOT_APPLICABLE";
  }
}

function routeDisplay(route: QuickRoute): {
  category: MatchAnalysisResponse["candidate_match"]["match_category"];
  action: MatchAnalysisResponse["candidate_match"]["recommended_action"];
  display: string;
} {
  if (route === "STRONG") {
    return { category: "STRONG_MATCH", action: "PRIORITIZE_AND_CALL", display: "Strong" };
  }
  if (route === "LOW_MATCH") {
    return { category: "NOT_A_MATCH", action: "KEEP_AS_POSSIBLE", display: "Low match" };
  }
  return { category: "POSSIBLE_MATCH", action: "CALL_AND_VERIFY", display: "Review" };
}

function expandQuickMatchRequirement(
  item: QuickMatchResponse["mandatory_requirements"][number],
  requirementType: RequirementItem["requirement_type"]
): RequirementItem {
  const evidence = item.evidence?.trim() ?? "";
  const source = mapQuickEvidenceSource(item.evidence_source);
  return {
    requirement: item.requirement,
    requirement_type: requirementType,
    status: item.status,
    requirement_outcome: quickOutcomeFromStatus(item.status),
    candidate_evidence: evidence,
    evidence_source: source === "NONE" && evidence ? "RESUME" : source,
    impact: "",
    verification_required: item.status !== "CONFIRMED" && item.status !== "NOT_APPLICABLE",
    confidence: item.status === "CONFIRMED" ? 80 : item.status === "PARTIAL" ? 50 : 20,
  };
}

export function expandQuickMatchToFull(raw: QuickMatchResponse): MatchAnalysisResponse {
  const metrics = recomputeQuickMatchMetrics(raw);
  const display = routeDisplay(metrics.quick_route);
  const blocking = raw.blocking_requirements.filter(Boolean);
  const itemsToVerify = raw.items_to_verify.filter(Boolean);
  const extracted = raw.extracted_resume;

  return matchAnalysisResponseSchema.parse({
    analysis_version: "1.0",
    candidate_match: {
      recommended_overall_match_score: 0,
      match_category: display.category,
      display_category: display.display,
      confidence_score: 0,
      mandatory_requirement_override: metrics.quick_route === "LOW_MATCH" && blocking.length > 0,
      recommended_action: display.action,
      recruiter_decision_summary: "",
    },
    experience_analysis: {
      total_professional_experience_years: extracted.years_estimated,
      relevant_specialty_experience_years: null,
      recent_relevant_experience_years: null,
      travel_experience_confirmed: false,
      required_work_setting_experience_confirmed: false,
      is_estimated: extracted.years_estimated != null,
      experience_calculation_notes: [
        extracted.headline,
        extracted.education,
        ...extracted.recent_titles,
      ]
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20),
    },
    mandatory_requirements: raw.mandatory_requirements.map((item) =>
      expandQuickMatchRequirement(item, "MANDATORY")
    ),
    preferred_requirements: raw.preferred_requirements.map((item) =>
      expandQuickMatchRequirement(item, "PREFERRED")
    ),
    strengths: [],
    gaps_and_risks: [],
    screening_questions: [],
    submission_readiness: {
      ready_to_submit: false,
      readiness_status: "INSUFFICIENT_INFORMATION",
      items_to_verify_before_submission: itemsToVerify,
      documents_or_credentials_needed: [],
      blocking_requirements: blocking,
    },
    quick_match: {
      step: "quick_match",
      quick_route: metrics.quick_route,
      extracted_resume: extracted,
      counts: metrics.counts,
      mand_met: metrics.mand_met,
      pref_met: metrics.pref_met,
      weighted: metrics.weighted,
    },
  });
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
      display_category:
        (lean.display_category ?? "").trim() || MATCH_CATEGORY_LABELS[lean.match_category],
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

function looksLikeQuickMatchOutput(obj: Record<string, unknown>): boolean {
  return obj.step === "quick_match" || typeof obj.quick_route === "string";
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

function normalizeEnumToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function parseRequirementStatus(value: unknown): RequirementStatus {
  const token = normalizeEnumToken(value);
  if ((REQUIREMENT_STATUSES as readonly string[]).includes(token)) {
    return token as RequirementStatus;
  }
  if (token === "MET" || token === "CONFIRMED_MATCH") return "CONFIRMED";
  if (token === "CONFLICT" || token === "CONFLICTS") return "CONFLICTING";
  if (token === "MISSING" || token === "ABSENT") return "NOT_FOUND";
  if (token === "NA" || token === "N_A" || token === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  return "NOT_FOUND";
}

function parseRequirementOutcome(
  value: unknown,
  status: RequirementStatus
): RequirementOutcome {
  const token = normalizeEnumToken(value);
  if ((REQUIREMENT_OUTCOMES as readonly string[]).includes(token)) {
    return token as RequirementOutcome;
  }
  return outcomeFromStatus(status);
}

function parseEvidenceSource(value: unknown, hasEvidence: boolean): EvidenceSource {
  const token = normalizeEnumToken(value);
  if ((EVIDENCE_SOURCES as readonly string[]).includes(token)) {
    return token as EvidenceSource;
  }
  return hasEvidence ? "RESUME" : "NONE";
}

function coerceConfidence(value: unknown, status: RequirementStatus): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim().replace(/%$/, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  }
  if (status === "CONFIRMED") return 80;
  if (status === "PARTIAL") return 50;
  if (status === "CONFLICTING") return 30;
  if (status === "NOT_APPLICABLE") return 0;
  return 20;
}

function coerceRequirementRow(
  item: unknown,
  fallbackType: RequirementItem["requirement_type"]
): Record<string, unknown> | unknown {
  if (!item || typeof item !== "object") return item;
  const row = item as Record<string, unknown>;
  const evidence =
    typeof row.candidate_evidence === "string"
      ? row.candidate_evidence
      : typeof row.evidence === "string"
        ? row.evidence
        : "";
  const status = parseRequirementStatus(row.status);
  const typeToken = normalizeEnumToken(row.requirement_type);
  const requirementType =
    typeToken === "PREFERRED" || typeToken === "MANDATORY"
      ? (typeToken as RequirementItem["requirement_type"])
      : fallbackType;
  return {
    ...row,
    requirement: String(row.requirement ?? "").trim() || String(row.name ?? "").trim(),
    requirement_type: requirementType,
    status,
    requirement_outcome: parseRequirementOutcome(row.requirement_outcome, status),
    candidate_evidence: evidence,
    evidence_source: parseEvidenceSource(row.evidence_source, Boolean(evidence.trim())),
    impact: typeof row.impact === "string" ? row.impact : "",
    verification_required:
      typeof row.verification_required === "boolean"
        ? row.verification_required
        : status !== "CONFIRMED" && status !== "NOT_APPLICABLE",
    confidence: coerceConfidence(row.confidence, status),
  };
}

function coerceScreeningQuestions(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of value) {
    if (out.length >= 5) break;
    if (typeof item === "string") {
      const question = item.trim();
      if (!question) continue;
      out.push({
        priority: out.length + 1,
        question,
        reason: "",
        related_requirement: "",
      });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const question =
      typeof row.question === "string"
        ? row.question.trim()
        : typeof row.text === "string"
          ? row.text.trim()
          : "";
    if (!question) continue;
    const priorityRaw = Number(row.priority);
    out.push({
      priority: Number.isFinite(priorityRaw) ? Math.max(1, Math.min(5, Math.round(priorityRaw))) : out.length + 1,
      question,
      reason: typeof row.reason === "string" ? row.reason : "",
      related_requirement:
        typeof row.related_requirement === "string"
          ? row.related_requirement
          : typeof row.relatedRequirement === "string"
            ? row.relatedRequirement
            : "",
    });
  }
  return out;
}

/** Normalize full Deep Match payloads before Zod validation. */
export function coerceFullMatchShape(obj: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...obj };

  if (Array.isArray(normalized.mandatory_requirements)) {
    normalized.mandatory_requirements = normalized.mandatory_requirements.map((item) =>
      coerceRequirementRow(item, "MANDATORY")
    );
  }
  if (Array.isArray(normalized.preferred_requirements)) {
    normalized.preferred_requirements = normalized.preferred_requirements.map((item) =>
      coerceRequirementRow(item, "PREFERRED")
    );
  }
  if (normalized.screening_questions != null) {
    normalized.screening_questions = coerceScreeningQuestions(normalized.screening_questions);
  }

  return normalized;
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

  if (looksLikeQuickMatchOutput(rawObject)) {
    const quickParsed = quickMatchResponseSchema.safeParse(rawObject);
    if (!quickParsed.success) {
      return {
        ok: false,
        errors: formatZodErrors(quickParsed.error),
        rawText,
        rawObject,
      };
    }
    return { ok: true, data: expandQuickMatchToFull(quickParsed.data), rawObject };
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

  // Coerce Deep Match / full schema quirks (string screening Qs, missing outcomes, NaN confidence).
  const normalized = coerceFullMatchShape({ ...rawObject } as Record<string, unknown>);

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
