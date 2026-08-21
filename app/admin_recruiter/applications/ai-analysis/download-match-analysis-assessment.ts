import { jsPDF } from "jspdf";
import {
  formatMatchCategory,
  formatMatchScore,
} from "@/lib/jobs/match-analysis/display";
import {
  RECRUITER_DECISION_LABELS,
  qualificationDisplayStatus,
  type QualificationRequirement,
  type RecruiterDecision,
} from "@/lib/jobs/match-analysis/workspace";
import type { MatchAnalysisParsed } from "./use-match-analysis-workspace";

type DownloadMatchAnalysisAssessmentInput = {
  candidateName: string;
  jobTitle: string;
  matchScore: number | null;
  matchLabel: string;
  recommendation: string;
  summary: string;
  confidencePercent: number | null;
  analysis: MatchAnalysisParsed | null;
  requirements: QualificationRequirement[];
  blocking: string[];
  strengths: string[];
  verificationNeeded: string[];
  recommendedQuestions: Array<{ question: string; answer?: string }>;
  analysisHistory: Array<{
    version: number;
    score: number | null;
    display_category: string | null;
    category: string | null;
    analyzed_at: string;
    model: string | null;
  }>;
  decision: RecruiterDecision | "";
  decisionNote: string;
  analyzedAt?: string | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function downloadMatchAnalysisAssessment(input: DownloadMatchAnalysisAssessmentInput): void {
  const doc = new jsPDF();
  let y = 14;

  const ensureSpace = (height = 8) => {
    if (y + height > 280) {
      doc.addPage();
      y = 14;
    }
  };

  const writeHeading = (text: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, 14, y);
    y += 7;
  };

  const writeParagraph = (text: string, indent = 14) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, 182 - indent);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, indent, y);
      y += 5;
    }
    y += 2;
  };

  const writeBullets = (items: string[]) => {
    if (!items.length) {
      writeParagraph("None.");
      return;
    }
    for (const item of items) {
      writeParagraph(`• ${item}`, 16);
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("AI Match Assessment", 14, y);
  y += 8;

  writeParagraph(`Candidate: ${input.candidateName}`);
  writeParagraph(`Job: ${input.jobTitle}`);
  writeParagraph(`Match score: ${formatMatchScore(input.matchScore)} (${input.matchLabel})`);
  if (input.confidencePercent != null) {
    writeParagraph(`Confidence: ${input.confidencePercent}%`);
  }
  if (input.recommendation) {
    writeParagraph(`Recommendation: ${input.recommendation}`);
  }
  if (input.analyzedAt) {
    writeParagraph(`Analyzed: ${formatWhen(input.analyzedAt)}`);
  }

  if (input.summary) {
    writeHeading("Summary");
    writeParagraph(input.summary);
  }

  writeHeading("Documented Strengths");
  writeBullets(input.strengths);

  writeHeading("Verification Needed");
  writeBullets(input.verificationNeeded);

  writeHeading("Qualification Checklist");
  if (!input.requirements.length) {
    writeParagraph("No requirements available.");
  } else {
    for (const req of input.requirements) {
      const status = qualificationDisplayStatus(req, input.blocking);
      writeParagraph(
        `${req.requirement_text} — ${req.requirement_type} — ${status}`,
        16
      );
      if (req.candidate_evidence?.trim()) {
        writeParagraph(`Evidence: ${req.candidate_evidence}`, 18);
      }
    }
  }

  writeHeading("Recommended Screening Questions");
  if (!input.recommendedQuestions.length) {
    writeParagraph("No recommended screening questions.");
  } else {
    for (const item of input.recommendedQuestions) {
      writeParagraph(item.question, 16);
      if (item.answer?.trim()) {
        writeParagraph(`Answer: ${item.answer}`, 18);
      }
    }
  }

  writeHeading("Analysis History");
  if (!input.analysisHistory.length) {
    writeParagraph("No previous analysis versions.");
  } else {
    for (const item of input.analysisHistory) {
      const label =
        item.display_category ||
        formatMatchCategory(item.category) ||
        "Not analyzed";
      writeParagraph(
        `Version ${item.version}: ${formatMatchScore(item.score)} — ${label} — ${formatWhen(item.analyzed_at)}${item.model ? ` · ${item.model}` : ""}`,
        16
      );
    }
  }

  if (input.decision) {
    writeHeading("Recruiter Decision");
    writeParagraph(RECRUITER_DECISION_LABELS[input.decision]);
    if (input.decisionNote.trim()) {
      writeParagraph(`Notes: ${input.decisionNote.trim()}`);
    }
  }

  const resumeCompleteness = input.analysis?.data_quality?.resume_completeness;
  const jobCompleteness = input.analysis?.data_quality?.job_description_completeness;
  if (resumeCompleteness || jobCompleteness) {
    writeHeading("Data Quality");
    if (resumeCompleteness) writeParagraph(`Resume completeness: ${resumeCompleteness}`);
    if (jobCompleteness) writeParagraph(`Job completeness: ${jobCompleteness}`);
  }

  const fileName = `${slugify(input.candidateName) || "candidate"}-${slugify(input.jobTitle) || "job"}-assessment.pdf`;
  doc.save(fileName);
}
