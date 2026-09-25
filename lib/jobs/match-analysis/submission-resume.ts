import { z } from "zod";
import {
  isSubmissionResumeFileName,
  sanitizeResumeNamePart,
} from "@/lib/resume/worker-resume-file-name";
import { normalizeResumeWhitespace } from "./sanitize-resume";
import type { MatchAnalysisResponse } from "./schema";

export { isSubmissionResumeFileName };

/** Trim and hard-cap length so LLM / requirement text never fails Zod `.max()`. */
const clipped = (max: number) =>
  z.preprocess((value) => {
    if (value == null) return "";
    return String(value).replace(/\s+/g, " ").trim().slice(0, max);
  }, z.string().max(max));

export const submissionResumeSchema = z.object({
  fullName: clipped(120),
  headline: clipped(200),
  email: clipped(200),
  phone: clipped(40),
  location: clipped(200),
  summary: clipped(1200),
  skills: z.array(clipped(80)).max(24).default([]),
  experience: z
    .array(
      z.object({
        title: clipped(160),
        company: clipped(160),
        dates: clipped(80),
        bullets: z.array(clipped(400)).max(8).default([]),
      })
    )
    .max(10)
    .default([]),
  education: z
    .array(
      z.object({
        school: clipped(200),
        credential: clipped(200),
        year: clipped(40),
      })
    )
    .max(8)
    .default([]),
  licenses: z.array(clipped(200)).max(12).default([]),
});

export type SubmissionResume = z.infer<typeof submissionResumeSchema>;

export type SubmissionResumeIdentity = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  jobTitle: string;
};

function cleanList(items: unknown, max: number, maxItemLength = 80): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const text = String(item ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxItemLength);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function confirmedRequirementLines(analysis: MatchAnalysisResponse | null): string[] {
  if (!analysis) return [];
  const rows = [
    ...(analysis.mandatory_requirements ?? []),
    ...(analysis.preferred_requirements ?? []),
  ];
  return rows
    .filter(
      (row) =>
        row.requirement_outcome === "MET" ||
        row.status === "CONFIRMED" ||
        row.requirement_outcome === "VERIFY"
    )
    .map((row) => row.requirement.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function educationFromAnalysis(analysis: MatchAnalysisResponse | null): SubmissionResume["education"] {
  const raw = analysis?.quick_match?.extracted_resume?.education?.trim() ?? "";
  if (!raw) return [];
  return [{ school: raw, credential: "", year: "" }];
}

function experienceFromTitles(
  analysis: MatchAnalysisResponse | null,
  resumeText: string
): SubmissionResume["experience"] {
  const titles = analysis?.quick_match?.extracted_resume?.recent_titles ?? [];
  const notes = analysis?.experience_analysis?.experience_calculation_notes ?? [];
  const evidence = (analysis?.mandatory_requirements ?? [])
    .map((row) => row.candidate_evidence.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (titles.length) {
    return titles.slice(0, 6).map((title, index) => ({
      title,
      company: "",
      dates: "",
      bullets:
        index === 0
          ? evidence.length
            ? evidence
            : notes.slice(0, 3)
          : notes.slice(index, index + 2),
    }));
  }

  const compact = normalizeResumeWhitespace(resumeText).slice(0, 2400);
  if (!compact) return [];
  return [
    {
      title: analysis?.quick_match?.extracted_resume?.headline || "Professional experience",
      company: "",
      dates: "",
      bullets: compact
        .split(/\n+/)
        .map((line) => line.replace(/^[-•]\s*/, "").trim())
        .filter((line) => line.length > 20)
        .slice(0, 8),
    },
  ];
}

export function submissionResumeFileName(
  fullName: string,
  ext: ".pdf" | ".docx" = ".pdf"
): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = sanitizeResumeNamePart(parts[0] ?? "");
  const last = sanitizeResumeNamePart(parts.slice(1).join(" "));
  const base = [first, last].filter(Boolean).join("_") || "candidate";
  return `${base}_submission_resume${ext}`;
}

/** Prefer short skill/product labels; drop long requirement sentences from fallback dumps. */
export function shortSkillLabels(items: string[], max = 16): string[] {
  return cleanList(
    items.filter((item) => {
      const text = String(item ?? "").trim();
      if (!text) return false;
      if (text.length > 60) return false;
      if (/\b(must|required|ability to|years of)\b/i.test(text) && text.split(/\s+/).length > 8) {
        return false;
      }
      return true;
    }),
    max
  );
}

export function parseSubmissionResume(value: unknown): SubmissionResume | null {
  const parsed = submissionResumeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function mergeSubmissionResume(
  preferred: SubmissionResume | null,
  fallback: SubmissionResume
): SubmissionResume {
  if (!preferred) return fallback;
  return {
    fullName: preferred.fullName || fallback.fullName,
    headline: preferred.headline || fallback.headline,
    email: preferred.email || fallback.email,
    phone: preferred.phone || fallback.phone,
    location: preferred.location || fallback.location,
    summary: preferred.summary || fallback.summary,
    skills: preferred.skills.length ? preferred.skills : fallback.skills,
    experience: preferred.experience.length ? preferred.experience : fallback.experience,
    education: preferred.education.length ? preferred.education : fallback.education,
    licenses: preferred.licenses.length ? preferred.licenses : fallback.licenses,
  };
}

export function buildFallbackSubmissionResume(args: {
  identity: SubmissionResumeIdentity;
  analysis: MatchAnalysisResponse | null;
  resumeText: string;
}): SubmissionResume {
  const { identity, analysis, resumeText } = args;
  const extracted = analysis?.quick_match?.extracted_resume;
  const years = extracted?.years_estimated;
  const headline =
    extracted?.headline?.trim() ||
    [identity.jobTitle, years ? `${years}+ years` : ""].filter(Boolean).join(" · ");
  const summary =
    analysis?.candidate_match?.recruiter_decision_summary?.trim() ||
    cleanList(analysis?.strengths, 3).join(" ") ||
    `Experienced ${headline || "professional"} available for ${identity.jobTitle || "this assignment"}.`;

  return submissionResumeSchema.parse({
    fullName: identity.fullName,
    headline,
    email: identity.email,
    phone: identity.phone,
    location: identity.location,
    summary,
    skills: shortSkillLabels([
      ...confirmedRequirementLines(analysis),
      ...(extracted?.named_products_in_jobs ?? []),
      ...(extracted?.recent_titles ?? []),
    ]),
    experience: experienceFromTitles(analysis, resumeText),
    education: educationFromAnalysis(analysis),
    licenses: [],
  });
}

export function submissionResumeToPlainText(resume: SubmissionResume): string {
  const lines: string[] = [resume.fullName];
  if (resume.headline) lines.push(resume.headline);
  const contact = [resume.location, resume.email, resume.phone].filter(Boolean).join("  |  ");
  if (contact) lines.push(contact);
  if (resume.summary) {
    lines.push("", "PROFESSIONAL SUMMARY", resume.summary);
  }
  if (resume.skills.length) {
    lines.push("", "CORE QUALIFICATIONS", resume.skills.map((item) => `• ${item}`).join("\n"));
  }
  if (resume.experience.length) {
    lines.push("", "RELEVANT EXPERIENCE");
    for (const job of resume.experience) {
      lines.push([job.title, job.company].filter(Boolean).join(" — "));
      if (job.dates) lines.push(job.dates);
      for (const bullet of job.bullets) lines.push(`• ${bullet}`);
    }
  }
  if (resume.education.length) {
    lines.push("", "EDUCATION");
    for (const item of resume.education) {
      lines.push([item.credential, item.school, item.year].filter(Boolean).join(" — "));
    }
  }
  if (resume.licenses.length) {
    lines.push("", "LICENSES & CERTIFICATIONS");
    for (const item of resume.licenses) lines.push(`• ${item}`);
  }
  return lines.join("\n");
}
