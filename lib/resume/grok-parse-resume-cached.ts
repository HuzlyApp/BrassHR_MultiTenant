import "server-only";

import { createHash } from "node:crypto";
import { getOrSetCache } from "@/lib/cache";
import { grokParseResume } from "@/lib/resume/grok-parse-resume";
import type { ResumeFieldExtractOptions } from "@/lib/resume/normalize-resume-text";
import type { NormalizedParsedResume } from "@/lib/resumeParseQuality";
import type { CandidateNameAssessment } from "@/lib/resume/validate-person-name";

/** Long enough for a recruiter to review the parse preview and submit the candidate. */
const RESUME_PARSE_CACHE_TTL_SECONDS = 30 * 60;

/** Bump when parse post-processing changes so stale empty city/state caches are not reused. */
const RESUME_PARSE_CACHE_VERSION = "v3-name-validation";

function resumeTextKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type CachedGrokParseResume = {
  normalized: NormalizedParsedResume;
  nameAssessment: CandidateNameAssessment;
};

/**
 * Grok resume parse memoized on the resume text, so previewing a resume and then creating
 * the candidate from it costs a single AI call.
 */
export async function grokParseResumeCached(
  text: string,
  opts?: ResumeFieldExtractOptions,
): Promise<NormalizedParsedResume> {
  return (await grokParseResumeCachedWithAssessment(text, opts)).normalized;
}

export async function grokParseResumeCachedWithAssessment(
  text: string,
  opts?: ResumeFieldExtractOptions,
): Promise<CachedGrokParseResume> {
  return getOrSetCache(
    `resume:grok-parse:${RESUME_PARSE_CACHE_VERSION}:${resumeTextKey(text)}`,
    async () => {
      const result = await grokParseResume(text, opts);
      return {
        normalized: result.normalized,
        nameAssessment: result.nameAssessment,
      };
    },
    RESUME_PARSE_CACHE_TTL_SECONDS
  );
}
