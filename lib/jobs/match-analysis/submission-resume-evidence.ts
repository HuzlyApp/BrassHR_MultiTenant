import type { SubmissionResume } from "./submission-resume";

export type SkillEvidenceQuality = "strong" | "adequate" | "keyword_stuffing";

export type SkillEvidenceResult = {
  keptSkills: string[];
  removedSkills: string[];
  quality: SkillEvidenceQuality;
  qualityNote: string;
};

function normalizeEvidenceCorpus(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => String(part ?? "").toLowerCase())
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
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
  const maxSkills = args.maxSkills ?? 16;
  const corpus = normalizeEvidenceCorpus([
    args.resumeText,
    ...(args.experienceBullets ?? []),
    args.enrichmentNotes,
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
    resume: { ...resume, skills: evidence.keptSkills },
    evidence,
  };
}
