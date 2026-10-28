import type { SubmissionResume } from "./submission-resume";

export type SkillEvidenceQuality = "strong" | "adequate" | "keyword_stuffing";

export type SkillEvidenceResult = {
  keptSkills: string[];
  removedSkills: string[];
  quality: SkillEvidenceQuality;
  qualityNote: string;
};

/** Gaps / denials / phone-screen callouts must never appear as Core Qualifications. */
const NEGATIVE_OR_NOTE_SKILL_PATTERN =
  /\b(?:not\s+certified|no\s+certification|uncertified|does\s+not\s+have|doesn't\s+have|do\s+not\s+have|has\s+not\s+|have\s+not\s+|lacks?\b|lacking\b|never\s+(?:used|worked|done|completed)|no\s+experience|not\s+experienced|unable\s+to|without\s+(?:a\s+)?cert|phone[\s-]?screen|recruiter\s+note|call\s+note|screening\s+note|interview\s+note|not\s+verified|needs?\s+verification)\b/i;

const TRAILING_NEGATION_PATTERN = /;\s*not\b/i;

const NEXT_ENRICHMENT_HEADING =
  /^(?:Screening question responses:|Follow-up questions and answers:|Verified information:|Recruiter notes:|Call context:)/i;

function normalizeEvidenceCorpus(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part ?? "").toLowerCase())
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Interview notes often list gaps and discussion topics. Keep them in the model
 * prompt, but do not treat them as positive skill evidence for Core Qualifications.
 */
export function stripInterviewNotesSection(enrichment: string | null | undefined): string {
  const text = String(enrichment ?? "");
  if (!text.trim()) return "";
  const lines = text.split(/\n/);
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^Interview notes:/i.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping && NEXT_ENRICHMENT_HEADING.test(trimmed)) {
      skipping = false;
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Drop enrichment lines that deny a skill/cert so "not certified in SAP"
 * cannot keep "SAP Oil and Gas" in Core Qualifications.
 */
export function stripNegativeEvidenceLines(enrichment: string | null | undefined): string {
  return String(enrichment ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (NEGATIVE_OR_NOTE_SKILL_PATTERN.test(line)) return false;
      if (TRAILING_NEGATION_PATTERN.test(line)) return false;
      return true;
    })
    .join("\n");
}

/** Prepare enrichment text used only for skill-evidence matching. */
export function sanitizeEnrichmentForSkillEvidence(
  enrichment: string | null | undefined
): string {
  return stripNegativeEvidenceLines(stripInterviewNotesSection(enrichment));
}

/**
 * Long parenthetical dumps that are not on the source résumé usually came from
 * pasted phone-screen notes (e.g. "Microsoft Power BI (KPI dashboards, …)").
 */
export function looksLikePastedRecruiterNoteSkill(
  skill: string,
  resumeText: string
): boolean {
  const text = String(skill ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 80) return false;
  const lower = text.toLowerCase();
  const resume = String(resumeText ?? "").toLowerCase();
  if (resume.includes(lower)) return false;
  const prefix = lower.slice(0, Math.min(48, lower.length));
  if (prefix.length >= 24 && resume.includes(prefix)) return false;
  const parenCount = (text.match(/\(/g) || []).length;
  return parenCount >= 1;
}

/** True when a skills[] line is a raw recruiter note or negative callout. */
export function isDisallowedSubmissionSkillLine(skill: string): boolean {
  const text = String(skill ?? "").replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (NEGATIVE_OR_NOTE_SKILL_PATTERN.test(text)) return true;
  if (TRAILING_NEGATION_PATTERN.test(text)) return true;
  return false;
}

/** Tokenize a skill label into searchable fragments (drop tiny connectors). */
function skillTokens(skill: string): string[] {
  return String(skill ?? "")
    .toLowerCase()
    .replace(/[/|,;]+/g, " ")
    .split(/[^a-z0-9.+#]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !["and", "or", "of", "the", "with", "to", "in", "for"].includes(token));
}

/**
 * A skill is supported when its full label (or enough distinctive tokens) appear
 * in the original résumé, experience bullets, enrichment, or confirmed evidence.
 */
export function skillHasSupportingEvidence(skill: string, corpus: string): boolean {
  const label = String(skill ?? "").trim().toLowerCase();
  if (!label || !corpus) return false;
  if (corpus.includes(label)) return true;

  const tokens = skillTokens(label);
  if (!tokens.length) return false;
  if (tokens.length === 1) return corpus.includes(tokens[0]!);

  const hits = tokens.filter((token) => corpus.includes(token)).length;
  // Require most tokens so "Azure DevOps Pipelines" isn't kept from a lone "Azure".
  const needed = tokens.length <= 2 ? tokens.length : Math.ceil(tokens.length * 0.67);
  return hits >= needed;
}

/**
 * Drop unsupported skills from the top technical summary and rate stuffing risk.
 * Also drops raw recruiter notes and negative callouts (e.g. "…; not certified").
 * Does not invent replacements — only removes claims lacking evidence.
 */
export function filterSkillsByEvidence(args: {
  skills: string[];
  resumeText: string;
  experienceBullets?: string[];
  enrichmentNotes?: string | null;
  confirmedEvidence?: string[];
  maxSkills?: number;
}): SkillEvidenceResult {
  const maxSkills = args.maxSkills ?? 40;
  const safeEnrichment = sanitizeEnrichmentForSkillEvidence(args.enrichmentNotes);
  const resumeText = String(args.resumeText ?? "");
  const corpus = normalizeEvidenceCorpus([
    resumeText,
    ...(args.experienceBullets ?? []),
    safeEnrichment,
    ...(args.confirmedEvidence ?? []),
  ]);

  const kept: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();

  for (const raw of args.skills) {
    const skill = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (
      isDisallowedSubmissionSkillLine(skill) ||
      looksLikePastedRecruiterNoteSkill(skill, resumeText)
    ) {
      removed.push(skill);
      continue;
    }

    if (skillHasSupportingEvidence(skill, corpus)) {
      if (kept.length < maxSkills) kept.push(skill);
      else removed.push(skill);
    } else {
      removed.push(skill);
    }
  }

  const inputCount = kept.length + removed.length;
  const removalRatio = inputCount ? removed.length / inputCount : 0;
  let quality: SkillEvidenceQuality = "strong";
  let qualityNote = "Core qualifications are grounded in résumé or recruiter-confirmed evidence.";

  if (inputCount >= 12 && removalRatio >= 0.4) {
    quality = "keyword_stuffing";
    qualityNote = `Keyword stuffing detected: ${removed.length} of ${inputCount} listed skills lacked supporting evidence and were removed from the summary.`;
  } else if (removed.length > 0) {
    quality = "adequate";
    qualityNote = `Removed ${removed.length} unsupported skill${removed.length === 1 ? "" : "s"} that did not appear in work history or confirmed evidence.`;
  }

  return { keptSkills: kept, removedSkills: removed, quality, qualityNote };
}

export function applySkillEvidenceFilter(
  resume: SubmissionResume,
  args: {
    resumeText: string;
    enrichmentNotes?: string | null;
    confirmedEvidence?: string[];
  }
): { resume: SubmissionResume; evidence: SkillEvidenceResult } {
  const experienceBullets = resume.experience.flatMap((job) => [
    job.title,
    job.company,
    job.location,
    job.dates,
    ...job.bullets,
  ]);
  const evidence = filterSkillsByEvidence({
    skills: resume.skills,
    resumeText: args.resumeText,
    experienceBullets,
    enrichmentNotes: args.enrichmentNotes,
    confirmedEvidence: args.confirmedEvidence,
  });
  return {
    resume: {
      ...resume,
      skills: evidence.keptSkills,
      // Keep experience bullets that are not raw negative callouts pasted from notes.
      experience: resume.experience.map((job) => ({
        ...job,
        bullets: job.bullets.filter((bullet) => !isDisallowedSubmissionSkillLine(bullet)),
      })),
    },
    evidence,
  };
}
