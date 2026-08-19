import type { CSSProperties } from "react";
import { applicationAiAnalysisHref } from "@/app/admin_recruiter/applications/CandidateAiAnalysisButton";
import { candidateAiAnalysisHref } from "@/app/admin_recruiter/candidates/candidate-links";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";

/** Figma Applicant Profile name — Desktop headline/H4 text-2xl, branding secondary (Brass navy). */
export const CANDIDATE_PROFILE_NAME_CLASS =
  "m-0 text-2xl font-semibold leading-8 text-[color:var(--brand-secondary)]";

export const CANDIDATE_PROFILE_NAME_STYLE: CSSProperties = {
  fontFamily: "Inter, var(--brand-font-heading), sans-serif",
};

export const PROFILE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "applications", label: "Applications" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
] as const;

export type CandidateProfileTabId = (typeof PROFILE_TABS)[number]["id"];

export function isCandidateProfileTabId(value: string | null): value is CandidateProfileTabId {
  return PROFILE_TABS.some((tab) => tab.id === value);
}

export function formatProfileApplicationDate(iso: string | null | undefined): {
  relative: string;
  absolute: string;
} {
  if (!iso) return { relative: "—", absolute: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { relative: "—", absolute: "" };
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  let relative = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (minutes < 1) relative = "Just now";
  else if (minutes < 60) relative = `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  else if (hours < 24) relative = `${hours} hour${hours === 1 ? "" : "s"} ago`;
  else if (days < 7) relative = `${days} day${days === 1 ? "" : "s"} ago`;
  return {
    relative,
    absolute: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export function workTypeBadgeClass(workType: string): string {
  const value = workType.trim().toUpperCase();
  if (value === "1099") return "bg-[#F3E8FF] text-[#7E22CE]";
  if (value === "W2") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (value === "CONTRACT") return "bg-[#FFEDD5] text-[#C2410C]";
  return "bg-[#F1F5F9] text-[#475569]";
}

export function profileStatusPillClass(status: string): string {
  switch (normalizeApplicationStatus(status)) {
    case "new":
    case "reviewing":
      return "bg-[#DBEAFE] text-[#1D4ED8]";
    case "shortlisted":
      return "bg-[#E0F2FE] text-[#0369A1]";
    case "interviewing":
      return "bg-[#DBEAFE] text-[#2563EB]";
    case "hired":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "rejected":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "undecided":
      return "bg-[#F1F5F9] text-[#475569]";
    case "archived":
      return "bg-[#E2E8F0] text-[#475569]";
    default:
      return "bg-[#DBEAFE] text-[#2563EB]";
  }
}

/** Recruiter help copy for the candidate-profile AI confidence ring. */
export const AI_CONFIDENCE_SCORE_TOOLTIP =
  "AI rating of how well this résumé matches the job.";

export function overallStatusBadgeClass(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "hired") return "bg-[#DCFCE7] text-[#15803D]";
  if (value === "closed" || value === "rejected") return "bg-[#FEE2E2] text-[#B91C1C]";
  return "bg-[#FFEDD5] text-[#C2410C]";
}

export function resumeIconType(fileName: string, fileType: string | null | undefined): "pdf" | "jpeg" {
  const lower = `${fileName} ${fileType ?? ""}`.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg") || lower.includes("png")) return "jpeg";
  return "pdf";
}

export function applicationReviewHref(applicationId: string, jobId?: string | null) {
  const params = new URLSearchParams({ applicationId });
  if (jobId?.trim()) params.set("jobId", jobId.trim());
  return `/admin_recruiter/applications/review?${params.toString()}`;
}

export function profileAiAnalysisHref(input: {
  workerId: string;
  applicationId?: string | null;
  jobId?: string | null;
}) {
  if (input.applicationId?.trim()) {
    return applicationAiAnalysisHref(input.applicationId.trim(), input.jobId || undefined);
  }
  return candidateAiAnalysisHref(input.workerId);
}

export function profileCandidatesBackHref(input: { from?: string | null; jobId?: string | null }) {
  if (input.from === "applications") {
    const jobId = input.jobId?.trim();
    return jobId
      ? `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`
      : "/admin_recruiter/applications";
  }
  return "/admin_recruiter/candidates";
}
