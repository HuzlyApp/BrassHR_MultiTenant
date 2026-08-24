import "server-only";

import { createHash } from "node:crypto";
import { getOrSetCache } from "@/lib/cache";
import { grokParseResume } from "@/lib/resume/grok-parse-resume";
import type { NormalizedParsedResume } from "@/lib/resumeParseQuality";

/** Long enough for a recruiter to review the parse preview and submit the candidate. */
const RESUME_PARSE_CACHE_TTL_SECONDS = 30 * 60;

function resumeTextKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Grok resume parse memoized on the resume text, so previewing a resume and then creating
 * the candidate from it costs a single AI call.
 */
export async function grokParseResumeCached(text: string): Promise<NormalizedParsedResume> {
  return getOrSetCache(
    `resume:grok-parse:${resumeTextKey(text)}`,
    async () => (await grokParseResume(text)).normalized,
    RESUME_PARSE_CACHE_TTL_SECONDS
  );
}
