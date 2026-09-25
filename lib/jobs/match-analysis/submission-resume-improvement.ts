import { z } from "zod";
import type { SkillEvidenceQuality } from "./submission-resume-evidence";
import type { SubmissionResume } from "./submission-resume";

const clipped = (max: number) =>
  z.preprocess((value) => {
    if (value == null) return "";
    return String(value).replace(/\s+/g, " ").trim().slice(0, max);
  }, z.string().max(max));

export const submissionImprovementSummarySchema = z.object({
  clarity: clipped(400).default(""),
  relevance: clipped(400).default(""),
  formatting: clipped(400).default(""),
  added: z.array(clipped(200)).max(12).default([]),
  removed: z.array(clipped(200)).max(12).default([]),
  needsVerification: z.array(clipped(200)).max(12).default([]),
  skillEvidenceQuality: z
    .enum(["strong", "adequate", "keyword_stuffing"])
    .default("adequate"),
  skillEvidenceNote: clipped(400).default(""),
  overall: clipped(600).default(""),
});

export type SubmissionImprovementSummary = z.infer<typeof submissionImprovementSummarySchema>;

function cleanList(items: unknown, max: number): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const text = String(item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export function parseImprovementSummary(value: unknown): SubmissionImprovementSummary | null {
  const parsed = submissionImprovementSummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function diffAddedRemoved(
  originalText: string,
  optimized: SubmissionResume
): { added: string[]; removed: string[] } {
  const originalLower = originalText.toLowerCase();
  const added: string[] = [];
  const removed: string[] = [];

  for (const license of optimized.licenses) {
    if (license && !originalLower.includes(license.toLowerCase().slice(0, 40))) {
      added.push(`Certification / license: ${license}`);
    }
  }
  for (const skill of optimized.skills.slice(0, 8)) {
    if (skill && !originalLower.includes(skill.toLowerCase())) {
      added.push(`Highlighted skill: ${skill}`);
    }
  }

  // Heuristic: long original skill dumps / keyword lists aren't mirrored in optimized.
  const originalSkillish = originalText.match(/(?:skills?|technologies|tools)[:\s]+([^\n]{20,400})/i);
  if (originalSkillish?.[1]) {
    const pieces = originalSkillish[1]
      .split(/[,;|•]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && part.length < 60);
    const kept = new Set(optimized.skills.map((s) => s.toLowerCase()));
    for (const piece of pieces.slice(0, 20)) {
      if (![...kept].some((k) => k.includes(piece.toLowerCase()) || piece.toLowerCase().includes(k))) {
        removed.push(`Trimmed unsupported / low-evidence item: ${piece}`);
      }
      if (removed.length >= 8) break;
    }
  }

  return { added: cleanList(added, 8), removed: cleanList(removed, 8) };
}

/**
 * Build a concise improvement summary from model output + evidence filter results.
 * Deterministic fields always win for skill-evidence quality.
 */
export function buildSubmissionImprovementSummary(args: {
  modelSummary?: unknown;
  originalResumeText: string;
  optimized: SubmissionResume;
  enrichmentNotes?: string | null;
  skillQuality: SkillEvidenceQuality;
  skillNote: string;
  removedSkills: string[];
}): SubmissionImprovementSummary {
  const fromModel = parseImprovementSummary(args.modelSummary);
  const diff = diffAddedRemoved(args.originalResumeText, args.optimized);
  const enrichmentHint = String(args.enrichmentNotes ?? "").trim()
    ? "Screening / follow-up / verified details were considered when supported."
    : "No additional screening enrichment was available.";

  const removed = cleanList(
    [
      ...(fromModel?.removed ?? []),
      ...diff.removed,
      ...args.removedSkills.map((skill) => `Unsupported skill removed: ${skill}`),
    ],
    12
  );
  const added = cleanList([...(fromModel?.added ?? []), ...diff.added], 12);
  const needsVerification = cleanList(fromModel?.needsVerification ?? [], 12);

  const clarity =
    fromModel?.clarity ||
    "Reordered and tightened wording so the strongest job-relevant experience appears first.";
  const relevance =
    fromModel?.relevance ||
    `Tailored emphasis toward the target role while keeping only claims supported by the résumé or recruiter-confirmed evidence. ${enrichmentHint}`;
  const formatting =
    fromModel?.formatting ||
    "Normalized section structure (summary, qualifications, experience, education, licenses) for MSP / client portal readability.";

  const overall =
    fromModel?.overall ||
    [
      clarity,
      args.skillQuality === "keyword_stuffing"
        ? "Skill summary was trimmed to reduce keyword stuffing."
        : null,
      needsVerification.length
        ? `${needsVerification.length} item(s) still need verification before claiming on the résumé.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

  return submissionImprovementSummarySchema.parse({
    clarity,
    relevance,
    formatting,
    added,
    removed,
    needsVerification,
    skillEvidenceQuality: args.skillQuality,
    skillEvidenceNote: args.skillNote,
    overall: overall.slice(0, 600),
  });
}
