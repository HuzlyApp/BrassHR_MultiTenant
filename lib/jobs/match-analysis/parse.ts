import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality";
import {
  matchAnalysisResponseSchema,
  type MatchAnalysisResponse,
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

/**
 * Strip markdown fences if present, parse JSON, validate with strict schema.
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

  // Coerce requirement_type if model omitted it based on array membership
  const normalized = { ...rawObject } as Record<string, unknown>;
  if (Array.isArray(normalized.mandatory_requirements)) {
    normalized.mandatory_requirements = normalized.mandatory_requirements.map((item) => {
      if (!item || typeof item !== "object") return item;
      return { requirement_type: "MANDATORY", ...(item as object) };
    });
  }
  if (Array.isArray(normalized.preferred_requirements)) {
    normalized.preferred_requirements = normalized.preferred_requirements.map((item) => {
      if (!item || typeof item !== "object") return item;
      return { requirement_type: "PREFERRED", ...(item as object) };
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
