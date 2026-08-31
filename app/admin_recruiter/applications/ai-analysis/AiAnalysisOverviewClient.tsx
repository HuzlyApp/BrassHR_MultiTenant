"use client";

import { Fragment, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  IdCard,
  Loader2,
  Medal,
  Search,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  CandidatesBreadcrumb,
  JobsBreadcrumb,
  jobCandidatesHrefForJob,
} from "@/app/admin_recruiter/jobs/JobsBreadcrumb";
import {
  formatMatchCategory,
  formatMatchScore,
  formatRecommendedAction,
  matchCategoryBadgeClassName,
} from "@/lib/jobs/match-analysis/display";
import {
  RECRUITER_DECISION_LABELS,
  VERIFIED_INFO_CATEGORIES,
  VERIFIED_INFO_CATEGORY_LABELS,
  filterQualificationRequirements,
  isVerifiedInfoCategory,
  qualificationDisplayStatus,
  recruiterActionLabel,
  type QualificationDisplayStatus,
  type QualificationFilter,
  type QualificationRequirement,
  type VerifiedInfoCategory,
} from "@/lib/jobs/match-analysis/workspace";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import { ResumeHistoryModal, type ResumeHistoryItem } from "../ResumeHistoryModal";
import { RemoveFromJobConfirmModal } from "../RemoveFromJobConfirmModal";
import { downloadMatchAnalysisAssessment } from "./download-match-analysis-assessment";
import { useMatchAnalysisWorkspace } from "./use-match-analysis-workspace";

const CARD =
  "rounded-[12px] border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const FIELD =
  "h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[color:var(--brand-primary)]";
const SELECT_FIELD =
  `${FIELD} appearance-none cursor-pointer bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-10`;
const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2398A2B3' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
const AREA =
  "w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[color:var(--brand-primary)]";
const PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const OUTLINE_BTN =
  "inline-flex items-center justify-center rounded-lg border-2 border-[color:var(--brand-secondary)] bg-white px-4 py-2.5 text-sm font-semibold text-[color:var(--brand-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
const HEADER_OUTLINE_BTN =
  "inline-flex h-8 items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-3 text-xs font-semibold leading-4 text-[color:var(--brand-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
const HEADER_PRIMARY_BTN =
  "inline-flex h-8 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-3 text-xs font-semibold leading-4 text-white transition hover:brightness-95 disabled:opacity-60";
const SIDEBAR_SAVE_BTN =
  "flex min-h-[60px] w-full min-w-0 flex-1 basis-0 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-3 py-3 text-sm font-semibold leading-5 text-white transition hover:brightness-95 disabled:opacity-60";
const SIDEBAR_REEXTRACT_BTN =
  "flex min-h-[60px] w-full min-w-0 flex-1 basis-0 items-center justify-center rounded-lg border-2 border-[color:var(--brand-secondary)] bg-white px-3 py-3 text-center text-sm font-semibold leading-5 text-[color:var(--brand-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
const SIDEBAR_TITLE_CLASS = "text-base font-semibold";
const SECTION_HEADER_DIVIDER = "border-b border-[#E5E7EB] pb-4";

function SidebarTitle({ children }: { children: ReactNode }) {
  const branding = useTenantBranding();

  return (
    <h2 className={SIDEBAR_TITLE_CLASS} style={{ color: branding.secondaryHex }}>
      {children}
    </h2>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  const branding = useTenantBranding();

  return (
    <h2 className="text-lg font-semibold" style={{ color: branding.secondaryHex }}>
      {children}
    </h2>
  );
}

function SectionHeaderBlock({ children }: { children: ReactNode }) {
  return <div className={SECTION_HEADER_DIVIDER}>{children}</div>;
}

function SidebarSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <SectionHeaderBlock>
      <SidebarTitle>{title}</SidebarTitle>
      {subtitle ? <p className="mt-1 text-sm text-[#667085]">{subtitle}</p> : null}
    </SectionHeaderBlock>
  );
}
const FILTERS = [
  "All",
  "Mandatory",
  "Preferred",
  "Confirmed",
  "Needs Verification",
  "Blocking",
] as const;

type FilterId = (typeof FILTERS)[number];

type AiAnalysisOverviewClientProps = {
  applicationId: string;
  backHref: string;
  jobId?: string;
};

function copyText(value: string, success: string) {
  void navigator.clipboard.writeText(value);
  toast.success(success);
}

function MatchRing({
  percent,
  label,
  strokeColor,
}: {
  percent: number | null;
  label: string;
  strokeColor: string;
}) {
  const outer = 139;
  const size = 121;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference - (fill / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: outer, height: outer }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex w-[79px] flex-col items-center text-center">
          <span className="h-9 text-[30px] font-semibold leading-9 text-black">
            {percent == null ? "—" : `${percent}%`}
          </span>
          <span className="text-xs font-normal leading-4 text-black/50">{label}</span>
        </div>
      </div>
    </div>
  );
}

const FILTER_TO_QUAL: Record<FilterId, QualificationFilter> = {
  All: "all",
  Mandatory: "mandatory",
  Preferred: "preferred",
  Confirmed: "confirmed",
  "Needs Verification": "needs_verification",
  Blocking: "blocking",
};

function AlignedIconListItem({
  iconSrc,
  children,
}: {
  iconSrc: string;
  children: string;
}) {
  return (
    <li className="flex items-start gap-3 text-sm text-[#344054]">
      <span className="inline-flex h-6 w-[18px] shrink-0 items-center justify-center">
        <img src={iconSrc} alt="" className="block h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-6">{children}</span>
    </li>
  );
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatHistoryWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function historyScoreBadgeClass(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "bg-[#F2F4F7] text-[#475467]";
  const n = Number(score);
  if (n >= 75) return "bg-[#00B135] text-white";
  if (n >= 50) return "bg-[#2563EB] text-white";
  if (n >= 25) return "bg-[#CA8A04] text-white";
  return "bg-[#DC2626] text-white";
}

function AnalysisHistoryItem({
  item,
}: {
  item: {
    id: string;
    version: number;
    score: number | null;
    category: string | null;
    display_category: string | null;
    model: string | null;
    analyzed_at: string;
  };
}) {
  const categoryLabel =
    item.display_category || formatMatchCategory(item.category) || "Not analyzed";

  return (
    <li className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-[#475467]">Version {item.version}</span>
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${historyScoreBadgeClass(item.score)}`}
          >
            {formatMatchScore(item.score)}
          </span>
          <span className="inline-flex rounded-md bg-[#E5E7EB] px-2 py-0.5 text-xs font-semibold text-[#344054]">
            {categoryLabel}
          </span>
        </div>
        <p className="text-xs leading-4 text-[#94A3B8]">
          {[formatHistoryWhen(item.analyzed_at), item.model].filter(Boolean).join(" · ")}
        </p>
      </div>
    </li>
  );
}

function verifiedCategoryLabel(category: string): string {
  if (isVerifiedInfoCategory(category)) return VERIFIED_INFO_CATEGORY_LABELS[category];
  return category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function verifiedCategoryBadgeClass(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (normalized === "license") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (normalized === "certification") return "bg-[#DCFCE7] text-[#166534]";
  if (normalized === "availability") return "bg-[#F3E8FF] text-[#7E22CE]";
  if (normalized === "note") return "bg-[#F2F4F7] text-[#475467]";
  return "bg-[#FFEDD5] text-[#9A3412]";
}

function VerifiedCategoryIcon({ category }: { category: string }) {
  const normalized = category.trim().toLowerCase();
  const className = "h-[18px] w-[18px] text-[color:var(--brand-primary)]";

  if (normalized === "license") return <IdCard className={className} aria-hidden />;
  if (normalized === "certification") return <Medal className={className} aria-hidden />;
  if (normalized === "availability") return <CalendarClock className={className} aria-hidden />;
  if (normalized === "note") return <FileText className={className} aria-hidden />;
  return <Tag className={className} aria-hidden />;
}

function VerifiedInformationItem({
  item,
}: {
  item: {
    id: string;
    category: string;
    title: string;
    details: string | null;
    verifiedAt: string;
    verifiedByName: string;
  };
}) {
  return (
    <li className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex">
        <div className="w-1 shrink-0 bg-[color:var(--brand-primary)]" aria-hidden />
        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--brand-primary) 12%, white)",
              }}
            >
              <VerifiedCategoryIcon category={item.category} />
            </span>
            <div className="min-w-0 flex-1">
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${verifiedCategoryBadgeClass(item.category)}`}
              >
                {verifiedCategoryLabel(item.category)}
              </span>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#101828]">{item.title}</p>
              {item.details ? (
                <p className="mt-1.5 text-sm leading-6 text-[#475467]">{item.details}</p>
              ) : null}
              <p className="mt-2 text-xs text-[#94A3B8]">
                Verified by {item.verifiedByName}
                {item.verifiedAt ? ` · ${formatWhen(item.verifiedAt)}` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function resolveAnalyzedResumeId(
  resumes: Array<{ id: string; uploadedAt?: string }>,
  analyzedAt: string | null | undefined,
  isAnalyzed: boolean
): string | null {
  if (!isAnalyzed || !analyzedAt?.trim() || resumes.length === 0) return null;
  const analyzedTime = new Date(analyzedAt).getTime();
  if (Number.isNaN(analyzedTime)) return null;

  const eligible = resumes.filter((resume) => {
    if (!resume.uploadedAt) return false;
    const uploadedTime = new Date(resume.uploadedAt).getTime();
    return !Number.isNaN(uploadedTime) && uploadedTime <= analyzedTime;
  });

  if (eligible.length === 0) return null;
  return eligible[eligible.length - 1]?.id ?? null;
}

function formatRequirementType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "mandatory") return "Mandatory";
  if (normalized === "preferred") return "Preferred";
  return type;
}

const CHECKLIST_BADGE =
  "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-center text-xs font-semibold text-white";

function typeBadgeClass(type: string) {
  return formatRequirementType(type) === "Mandatory" ? "bg-[#00B135]" : "bg-[#0284C7]";
}

function statusBadgeClass(status: QualificationDisplayStatus) {
  if (status === "Confirmed") return "bg-[#2563EB]";
  if (status === "Blocking") return "bg-[#DC2626]";
  if (status === "Not Met") return "bg-[#EA580C]";
  return "bg-[#CA8A04]";
}

function ringStrokeColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "#E5E7EB";
  const n = Number(score);
  if (n >= 75) return "#00B546";
  if (n >= 50) return "#3B82F6";
  if (n >= 25) return "#F59E0B";
  return "#EF4444";
}

function overviewMatchTagClass(category: string | null | undefined): string {
  if (category === "STRONG_MATCH" || category === "GOOD_MATCH") {
    return "bg-[#00B135] text-white";
  }
  return matchCategoryBadgeClassName(category);
}

export function AiAnalysisOverviewClient({
  applicationId,
  backHref,
  jobId,
}: AiAnalysisOverviewClientProps) {
  const router = useRouter();
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const [workspaceReloadToken, setWorkspaceReloadToken] = useState(0);
  const workspace = useMatchAnalysisWorkspace(applicationId, workspaceReloadToken);
  const {
    loading,
    analyzing,
    data,
    analysis,
    blocking,
    verifyItems,
    isAnalyzed,
    verifyingId,
    toggleVerified,
    recommendedAnswers,
    setRecommendedAnswers,
    savingAnswers,
    decision,
    setDecision,
    decisionNote,
    setDecisionNote,
    savingDecision,
    verifiedTitle,
    setVerifiedTitle,
    verifiedDetails,
    setVerifiedDetails,
    verifiedCategory,
    setVerifiedCategory,
    savingVerified,
    teamMembers,
    assignedId,
    setAssignedId,
    info,
    setInfo,
    savingInfo,
    extractedDraft,
    setExtractedDraft,
    savingText,
    resumes,
    openingResumeId,
    viewResume,
    runAnalyze,
    saveScreeningAnswers,
    recordDecision,
    addVerified,
    saveDetails,
    reextractContact,
    saveExtractedText,
    decisionOptions,
  } = workspace;

  const [filter, setFilter] = useState<FilterId>("All");
  const [query, setQuery] = useState("");
  const [openReqId, setOpenReqId] = useState("");
  const [dataQualityOpen, setDataQualityOpen] = useState(true);

  /* ── Resume History Modal state ── */
  const [resumeHistoryOpen, setResumeHistoryOpen] = useState(false);
  const [resumeHistoryItems, setResumeHistoryItems] = useState<ResumeHistoryItem[]>([]);
  const [resumeHistoryLoading, setResumeHistoryLoading] = useState(false);
  const [resumeHistoryError, setResumeHistoryError] = useState<string | null>(null);
  const [resumeHistoryBusyId, setResumeHistoryBusyId] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingFromJob, setRemovingFromJob] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [downloadingAssessment, setDownloadingAssessment] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const loadResumeHistory = useCallback(async () => {
    setResumeHistoryLoading(true);
    setResumeHistoryError(null);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resume-history`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        error?: string;
        resumes?: ResumeHistoryItem[];
      };
      if (!response.ok) throw new Error(payload.error || "Could not load resume history.");
      setResumeHistoryItems(payload.resumes ?? []);
    } catch (err) {
      setResumeHistoryError(err instanceof Error ? err.message : "Could not load resume history.");
      setResumeHistoryItems([]);
    } finally {
      setResumeHistoryLoading(false);
    }
  }, [applicationId]);

  function openResumeHistory() {
    setResumeHistoryOpen(true);
    void loadResumeHistory();
  }

  async function viewResumeFromHistory(resumeId: string) {
    setResumeHistoryBusyId(resumeId);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resumeId)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      const url = payload.url?.trim() ?? "";
      if (!response.ok || !url) throw new Error(payload.error || "Could not open resume.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open resume.");
    } finally {
      setResumeHistoryBusyId(null);
    }
  }

  async function parseResumeFromHistory(resumeId: string) {
    setResumeHistoryBusyId(resumeId);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resumeId)}/parse`,
        { method: "POST" }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string; resumes?: ResumeHistoryItem[] };
      if (!response.ok) throw new Error(payload.error || "Could not parse resume.");
      if (payload.resumes) setResumeHistoryItems(payload.resumes);
      else await loadResumeHistory();
      toast.success("Resume parsed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not parse resume.");
    } finally {
      setResumeHistoryBusyId(null);
    }
  }

  async function deleteResumeFromHistory(resumeId: string, fileName: string) {
    if (!window.confirm(`Delete ${fileName}? This cannot be undone.`)) return;
    setResumeHistoryBusyId(resumeId);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resumeId)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json().catch(() => ({}))) as { resumes?: ResumeHistoryItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete resume.");
      setResumeHistoryItems(payload.resumes ?? []);
      setWorkspaceReloadToken((t) => t + 1);
      toast.success("Resume deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete resume.");
    } finally {
      setResumeHistoryBusyId(null);
    }
  }

  function beginReuploadResume() {
    resumeInputRef.current?.click();
  }

  async function handleResumeFileSelected(file: File | undefined) {
    if (!file) return;
    setResumeUploading(true);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resume`,
        { method: "POST", body: formData }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string; resumes?: ResumeHistoryItem[] };
      if (!response.ok) throw new Error(payload.error || "Could not upload resume.");
      await loadResumeHistory();
      setWorkspaceReloadToken((t) => t + 1);
      toast.success("Resume uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload resume.");
    } finally {
      setResumeUploading(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  }

  function openRemoveFromJobConfirm() {
    setRemoveError(null);
    setRemoveConfirmOpen(true);
  }

  async function handleRunAnalyze() {
    const ok = await runAnalyze();
    if (!ok) return;
    setOpenReqId("");
    router.refresh();
  }

  async function confirmRemoveFromJob() {
    setRemovingFromJob(true);
    setRemoveError(null);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/remove`,
        { method: "DELETE", credentials: "include", cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to remove from job");
      setRemoveConfirmOpen(false);
      toast.success("Candidate removed from this job");
      window.location.assign(backHref);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove from job";
      setRemoveError(message);
      toast.error(message);
      setRemovingFromJob(false);
    }
  }

  const app = data?.application;
  const matchScore =
    isAnalyzed && app?.ai_match_score != null && Number.isFinite(Number(app.ai_match_score))
      ? Number(app.ai_match_score)
      : null;
  const matchLabel =
    app?.ai_match_display_category || formatMatchCategory(app?.ai_match_category) || "Not analyzed";
  const candidateName = `${info.firstName} ${info.lastName}`.trim() || "Candidate";
  const jobTitle = analysis?.job?.job_title?.trim() || "—";
  const confidencePercent =
    analysis?.candidate_match?.confidence_score != null
      ? Math.round(Number(analysis.candidate_match.confidence_score))
      : null;
  const recommendation = formatRecommendedAction(app?.ai_match_action);
  const summary = analysis?.candidate_match?.recruiter_decision_summary ?? "";
  const strengths = analysis?.strengths ?? [];
  const verificationNeeded =
    verifyItems.length > 0 ? verifyItems : analysis?.gaps_and_risks ?? [];
  const recommendedQuestions = data?.recommendedQuestions ?? [];
  const resumeCompleteness = analysis?.data_quality?.resume_completeness ?? "—";
  const jobCompleteness = analysis?.data_quality?.job_description_completeness ?? "—";
  const analysisHistory = useMemo(() => {
    const rows = data?.analysisHistory ?? [];
    if (rows.length) return rows;
    if (!app || (app.ai_match_status !== "ANALYZED" && app.ai_match_score == null)) return [];
    return [
      {
        id: app.id,
        version: Number(app.ai_analysis_version) || 1,
        score: app.ai_match_score,
        category: app.ai_match_category,
        display_category: app.ai_match_display_category,
        model: app.ai_analysis_model,
        analyzed_at: app.ai_analyzed_at ?? "",
      },
    ];
  }, [data?.analysisHistory, app]);

  const noteFeedItems = useMemo(() => {
    const verified = (data?.verifiedInformation ?? []).map((item) => ({
      kind: "verified" as const,
      id: item.id,
      sortAt: item.verifiedAt,
      item,
    }));
    const notes = (data?.notes ?? []).map((note) => ({
      kind: "note" as const,
      id: note.id,
      sortAt: note.created_at,
      note,
    }));
    return [...verified, ...notes].sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    );
  }, [data?.verifiedInformation, data?.notes]);

  const latestResumeId =
    resumes.length > 1 ? resumes[resumes.length - 1]?.id ?? null : null;
  const analyzedResumeId = useMemo(
    () => resolveAnalyzedResumeId(resumes, app?.ai_analyzed_at, isAnalyzed),
    [resumes, app?.ai_analyzed_at, isAnalyzed]
  );

  const filteredRequirements = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = filterQualificationRequirements(
      data?.requirements ?? [],
      FILTER_TO_QUAL[filter],
      blocking
    );
    if (!q) return base;
    return base.filter((row) => row.requirement_text.toLowerCase().includes(q));
  }, [filter, query, data?.requirements, blocking]);

  function handleDownloadAssessment() {
    if (!isAnalyzed) {
      toast.error("Run analysis before downloading the assessment.");
      return;
    }
    setDownloadingAssessment(true);
    try {
      downloadMatchAnalysisAssessment({
        candidateName,
        jobTitle,
        matchScore: app?.ai_match_score ?? null,
        matchLabel,
        recommendation,
        summary,
        confidencePercent,
        analysis,
        requirements: data?.requirements ?? [],
        blocking,
        strengths,
        verificationNeeded,
        recommendedQuestions: recommendedQuestions.map((item) => ({
          question: item.question,
          answer: recommendedAnswers[item.key] ?? item.answer ?? "",
        })),
        analysisHistory,
        decision,
        decisionNote,
        analyzedAt: app?.ai_analyzed_at,
      });
      toast.success("Assessment downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download assessment.");
    } finally {
      setDownloadingAssessment(false);
    }
  }

  if (loading) {
    return (
      <div
        className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8"
        style={brandStyle}
      >
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-6 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AI analysis…
        </div>
      </div>
    );
  }

  return (
    <div
      className="box-border w-full min-w-0 max-w-full px-3 pb-10 pt-4 sm:px-5 sm:pt-5 lg:px-8"
      style={brandStyle}
      data-application-id={applicationId}
    >
      {backHref.includes("/admin_recruiter/applications") ? (
        <JobsBreadcrumb
          page="ai-analysis"
          jobCandidatesHref={jobCandidatesHrefForJob(jobId) || backHref}
        />
      ) : (
        <CandidatesBreadcrumb currentLabel="AI Analysis" backHref={backHref} />
      )}

      <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
        AI Analysis Overview
      </h1>

      <div className="mt-6 grid items-start gap-5 sm:gap-[30px] lg:grid-cols-[minmax(0,1fr)_350px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <div className="flex flex-col items-center gap-5 border-b border-[#E5E7EB] px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
              <div className="flex w-full min-w-0 flex-col items-center gap-4 text-center sm:w-auto sm:flex-row sm:items-center sm:gap-5 sm:text-left">
                <MatchRing
                  percent={matchScore == null ? null : Math.round(matchScore)}
                  label={matchLabel}
                  strokeColor={ringStrokeColor(matchScore)}
                />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-7 text-[#374151] sm:text-2xl sm:leading-8">{candidateName}</h2>
                  <p className="mt-0.5 text-sm leading-5 text-[#6B7280]">For: {jobTitle}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-normal leading-[15px] ${overviewMatchTagClass(app?.ai_match_category)}`}
                    >
                      {matchLabel}
                    </span>
                    {confidencePercent != null && confidencePercent > 0 ? (
                      <span className="inline-flex rounded-full bg-[#001A46] px-2.5 py-1 text-[10px] font-normal leading-[15px] text-white">
                        Confidence {confidencePercent}%
                      </span>
                    ) : null}
                    {recommendation ? (
                      <span className="inline-flex rounded-full bg-[#ECF1F9] px-2.5 py-1 text-[10px] font-normal leading-[15px] text-[#012352]">
                        {recommendation}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-start sm:gap-3">
                <button type="button" className={HEADER_OUTLINE_BTN}>
                  Attempted Contacted
                </button>
                <button
                  type="button"
                  className={HEADER_PRIMARY_BTN}
                  disabled={analyzing}
                  onClick={() => void handleRunAnalyze()}
                >
                  {analyzing ? "Analyzing…" : isAnalyzed ? "Reanalyze" : "Analyze candidate"}
                </button>
              </div>
            </div>
            {app?.ai_analysis_error ? (
              <p className="border-b border-[#E5E7EB] px-5 py-5 text-xs leading-4 text-[#B91C1C]">{app.ai_analysis_error}</p>
            ) : null}
            {summary ? (
              <p className="px-5 py-5 text-xs leading-4 text-[#4B5563]">{summary}</p>
            ) : !isAnalyzed ? (
              <p className="px-5 py-5 text-xs leading-4 text-[#6B7280]">
                This candidate has not been analyzed yet. Run analysis to populate match results.
              </p>
            ) : null}
          </section>

          <section className={CARD}>
            <SectionHeaderBlock>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BrandedSvgIcon
                    src="/Qualification-checklist.svg"
                    className="h-[15px] w-[18px]"
                    color="var(--brand-primary)"
                  />
                  <SectionTitle>Qualification Checklist</SectionTitle>
                </div>
              </div>
            </SectionHeaderBlock>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max flex-nowrap items-center gap-2">
                {FILTERS.map((item) => {
                  const active = filter === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                        active
                          ? "bg-[color:var(--brand-primary)] text-white"
                          : "bg-[#F2F4F7] hover:bg-[#E4E7EC]"
                      }`}
                      style={active ? undefined : { color: branding.secondaryHex }}
                    >
                      {item}
                    </button>
                  );
                })}
                </div>
              </div>
              <label className="relative w-full sm:max-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search requirements..."
                  className={`${FIELD} h-10 pl-9`}
                />
              </label>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[720px] w-full text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                    <th className="py-3 pr-3 text-left">Requirement</th>
                    <th className="py-3 pr-3 text-center">Type</th>
                    <th className="py-3 pr-3 text-center">Status</th>
                    <th className="py-3 text-left">Action</th>
                    <th className="w-10 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRequirements.map((row: QualificationRequirement) => {
                    const open = openReqId === row.id;
                    const displayStatus = qualificationDisplayStatus(row, blocking);
                    const actionLabel = recruiterActionLabel(row);
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={`cursor-pointer hover:bg-[#F9FAFB] ${open ? "" : "border-b border-[#F2F4F7]"}`}
                          onClick={() => setOpenReqId(open ? "" : row.id)}
                        >
                          <td className="py-3.5 pr-3">
                            <p className="cursor-pointer text-sm font-medium leading-5 text-[#101828]">
                              {row.requirement_text}
                            </p>
                          </td>
                          <td className="py-3.5 pr-3 text-center">
                            <span className={`${CHECKLIST_BADGE} ${typeBadgeClass(row.requirement_type)}`}>
                              {formatRequirementType(row.requirement_type)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-3 text-center">
                            <span className={`${CHECKLIST_BADGE} ${statusBadgeClass(displayStatus)}`}>
                              {displayStatus}
                            </span>
                          </td>
                          <td className="py-3.5 text-sm text-[#475467]">{actionLabel}</td>
                          <td className="py-3.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"
                              aria-expanded={open}
                              aria-label={open ? "Collapse candidate evidence" : "Expand candidate evidence"}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenReqId(open ? "" : row.id);
                              }}
                            >
                              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-b border-[#F2F4F7]">
                            <td colSpan={5} className="pb-4 pr-3">
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                                  Candidate Evidence
                                </p>
                                <div className="mt-2 flex items-start justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    {row.candidate_evidence ? (
                                      <blockquote className="border-l-[3px] border-[color:var(--brand-primary)] pl-3 text-sm italic leading-6 text-[#344054]">
                                        {row.candidate_evidence}
                                      </blockquote>
                                    ) : (
                                      <p className="text-sm leading-6 text-[#667085]">
                                        No candidate evidence recorded.
                                      </p>
                                    )}
                                    {row.impact ? (
                                      <p className="mt-2 text-xs leading-5 text-[#667085]">
                                        <span className="font-semibold text-[#475467]">Impact:</span> {row.impact}
                                      </p>
                                    ) : null}
                                  </div>
                                  <label
                                    htmlFor={`recruiter-verified-${row.id}`}
                                    className="inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap pt-0.5 text-sm font-medium text-[#344054]"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <ListTableCheckbox
                                      id={`recruiter-verified-${row.id}`}
                                      size="md"
                                      className="cursor-pointer"
                                      checked={row.recruiter_verified}
                                      disabled={verifyingId === row.id}
                                      onChange={() => void toggleVerified(row)}
                                      aria-label={`Recruiter verified: ${row.requirement_text}`}
                                    />
                                    Recruiter verified
                                    {verifyingId === row.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#98A2B3]" />
                                    ) : null}
                                  </label>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]">
                                  <button
                                    type="button"
                                    className="cursor-pointer font-medium text-[color:var(--brand-primary)] hover:underline"
                                    onClick={() => setOpenReqId("")}
                                  >
                                    Show less
                                  </button>
                                  <span>
                                    Source: {row.evidence_source || "Resume"} • Confidence: {row.confidence}%
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                  {!filteredRequirements.length ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-[#667085]">
                        No requirements match this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className={CARD}>
              <SectionHeaderBlock>
                <div className="flex items-center gap-2">
                  <BrandedSvgIcon
                    src="/akar-icons_trophy.svg"
                    className="h-[20px] w-[20px]"
                    color="var(--brand-primary)"
                  />
                  <SectionTitle>Documented Strengths</SectionTitle>
                </div>
              </SectionHeaderBlock>
              <ul className="mt-4 space-y-3">
                {strengths.length ? (
                  strengths.map((item) => (
                    <AlignedIconListItem key={item} iconSrc="/icon-park-solid_check-one.svg">
                      {item}
                    </AlignedIconListItem>
                  ))
                ) : (
                  <li className="text-sm text-[#667085]">No documented strengths in this analysis.</li>
                )}
              </ul>
            </section>

            <section className={CARD}>
              <SectionHeaderBlock>
                <div className="flex items-center gap-2">
                  <BrandedSvgIcon
                    src="/selfhst_web-check-dark.svg"
                    className="h-[20px] w-[20px]"
                    color="var(--brand-primary)"
                  />
                  <SectionTitle>Verification Needed</SectionTitle>
                </div>
              </SectionHeaderBlock>
              <ul className="mt-4 space-y-3">
                {verificationNeeded.length ? (
                  verificationNeeded.map((item) => (
                    <AlignedIconListItem key={item} iconSrc="/ic_round-warning.svg">
                      {item}
                    </AlignedIconListItem>
                  ))
                ) : (
                  <li className="text-sm text-[#667085]">No additional verification items identified.</li>
                )}
              </ul>
            </section>
          </div>

          <section className={CARD}>
            <SectionHeaderBlock>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionTitle>Recommended Screening Questions</SectionTitle>
                  <p className="mt-1 text-sm text-[#667085]">
                    {recommendedQuestions.length} targeted questions to confirm before submission.
                  </p>
                </div>
                {recommendedQuestions.length ? (
                  <button
                    type="button"
                    className={`${OUTLINE_BTN} h-10 gap-2 px-3`}
                    onClick={() =>
                      copyText(
                        recommendedQuestions.map((item, index) => `${index + 1}. ${item.question}`).join("\n\n"),
                        "Questions copied"
                      )
                    }
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    Copy all
                  </button>
                ) : null}
              </div>
            </SectionHeaderBlock>

            <div className="mt-4 space-y-4">
              {recommendedQuestions.length ? (
                recommendedQuestions.map((item, index) => (
                  <article key={item.key} className="rounded-[12px] border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--brand-primary)] text-sm font-semibold text-[color:var(--brand-primary)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="flex-1 text-sm font-semibold leading-6 text-[#101828]">{item.question}</p>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-white"
                            aria-label="Copy question"
                            onClick={() => copyText(item.question, "Question copied")}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        {item.reason ? (
                          <p className="mt-2 text-sm leading-5 text-[#344054]">
                            <span className="font-medium">Why this matters:</span> {item.reason}
                          </p>
                        ) : null}
                        {item.relatedRequirement ? (
                          <p className="mt-1 text-sm leading-5 text-[#667085]">
                            <span className="font-medium text-[#475467]">Related:</span> {item.relatedRequirement}
                          </p>
                        ) : null}
                        <input
                          value={recommendedAnswers[item.key] ?? ""}
                          onChange={(event) =>
                            setRecommendedAnswers((current) => ({ ...current, [item.key]: event.target.value }))
                          }
                          placeholder="Record the candidate answer..."
                          className={`${FIELD} mt-3`}
                        />
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-sm text-[#667085]">No recommended screening questions for this analysis.</p>
              )}
            </div>

            {recommendedQuestions.length ? (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className={OUTLINE_BTN}
                  disabled={savingAnswers}
                  onClick={() => void saveScreeningAnswers()}
                >
                  {savingAnswers ? "Saving…" : "Save screening answers"}
                </button>
              </div>
            ) : null}
          </section>

          <section className={CARD}>
            <SectionHeaderBlock>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setDataQualityOpen((open) => !open)}
                aria-expanded={dataQualityOpen}
              >
                <div>
                  <SectionTitle>Data Quality & Analysis Notes</SectionTitle>
                  <p className="mt-1 text-sm text-[#667085]">
                    Resume completeness: {resumeCompleteness} • Job Completeness: {jobCompleteness}
                  </p>
                </div>
                {dataQualityOpen ? (
                  <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-[#667085]" />
                ) : (
                  <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[#667085]" />
                )}
              </button>
            </SectionHeaderBlock>

            {dataQualityOpen ? (
              <div className="mt-4 space-y-5 text-sm leading-6 text-[#344054]">
                <NoteBlock title="Missing Information" items={analysis?.data_quality?.missing_information ?? []} />
                <NoteBlock
                  title="Job-description conflicts"
                  items={analysis?.data_quality?.job_description_conflicts ?? []}
                  empty="None."
                />
                <NoteBlock title="Résumé conflicts" items={analysis?.data_quality?.resume_conflicts ?? []} />
                <NoteBlock
                  title="Experience calculations"
                  items={analysis?.experience_analysis?.experience_calculation_notes ?? []}
                />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className={CARD}>
            <SidebarSectionHeader title="Candidate information" />
            <div className="mt-4 space-y-3">
              <Field label="Assigned recruiter">
                <select
                  value={assignedId}
                  onChange={(event) => setAssignedId(event.target.value)}
                  className={SELECT_FIELD}
                  style={{ backgroundImage: SELECT_CHEVRON }}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Full name">
                <input
                  value={`${info.firstName} ${info.lastName}`.trim()}
                  onChange={(event) => {
                    const [first, ...rest] = event.target.value.split(" ");
                    setInfo((current) => ({
                      ...current,
                      firstName: first || "",
                      lastName: rest.join(" "),
                    }));
                  }}
                  className={FIELD}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <Field label="Email">
                  <input
                    value={info.email}
                    onChange={(event) => setInfo((current) => ({ ...current, email: event.target.value }))}
                    className={FIELD}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={info.phone}
                    onChange={(event) => setInfo((current) => ({ ...current, phone: event.target.value }))}
                    className={FIELD}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <Field label="Specialty">
                  <input
                    value={info.specialty}
                    onChange={(event) => setInfo((current) => ({ ...current, specialty: event.target.value }))}
                    className={FIELD}
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={info.location}
                    onChange={(event) => setInfo((current) => ({ ...current, location: event.target.value }))}
                    className={FIELD}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex w-full items-stretch gap-3">
              <button
                type="button"
                className={SIDEBAR_SAVE_BTN}
                disabled={savingInfo}
                onClick={() => void saveDetails()}
              >
                {savingInfo ? "Saving…" : "Save Details"}
              </button>
              <button type="button" className={SIDEBAR_REEXTRACT_BTN} onClick={() => void reextractContact()}>
                Re-extract contact details
              </button>
            </div>
          </section>

          <section className={CARD}>
            <SidebarSectionHeader title="Resume" />
            {resumes.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2">
                {resumes.map((resume, index) => {
                  const isLatest = resumes.length > 1 && index === resumes.length - 1;
                  return (
                    <div
                      key={resume.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                        isLatest
                          ? "border border-[#E5E7EB] bg-white"
                          : "border border-[#E5E7EB] bg-white"
                      }`}
                    >
                      <BrandedFileTypeIcon
                        type={resume.fileIconType ?? "pdf"}
                        className="mt-0.5 h-7 w-7 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            disabled={openingResumeId === resume.id}
                            onClick={() => void viewResume(resume.id)}
                            className="block max-w-full truncate text-left text-sm font-semibold text-[color:var(--brand-primary)] hover:underline disabled:opacity-60"
                            title={`View ${resume.fileName}`}
                            aria-label={`View ${resume.fileName}`}
                          >
                            {resume.fileName}
                          </button>
                          {isLatest ? (
                            <span className="shrink-0 rounded-md bg-[color:var(--brand-secondary)] px-2 py-0.5 text-[11px] font-semibold text-white">
                              Latest
                            </span>
                          ) : null}
                        </div>
                        {resume.uploadedAtLabel || resume.uploadedAt ? (
                          <p className="mt-0.5 text-xs text-[#667085]">
                            Uploaded{" "}
                            {resume.uploadedAtLabel || formatWhen(resume.uploadedAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-3">
                <BrandedFileTypeIcon type="pdf" className="h-7 w-7 shrink-0" />
                <span className="truncate text-sm font-medium text-[#344054]">
                  {data?.extractedResume?.fileName || "No resume uploaded"}
                </span>
              </div>
            )}
          </section>

          <section className={CARD}>
            <SidebarSectionHeader
              title="Extracted Resume"
              subtitle="Correct before analysis if needed."
            />
            <textarea
              value={extractedDraft}
              onChange={(event) => setExtractedDraft(event.target.value)}
              rows={12}
              className={`${AREA} mt-4 max-h-[280px] font-mono text-xs leading-5`}
            />
            <div className="mt-3">
              <button
                type="button"
                className={`${PRIMARY_BTN} w-auto`}
                disabled={savingText}
                onClick={() => void saveExtractedText()}
              >
                {savingText ? "Saving…" : "Save extracted text"}
              </button>
            </div>
          </section>

          <section className={CARD}>
            <SidebarSectionHeader
              title="Notes"
              subtitle="Recruiter notes and verified evidence for this workspace."
            />
            {noteFeedItems.length ? (
              <ul className="mt-4 space-y-3">
                {noteFeedItems.map((entry) =>
                  entry.kind === "verified" ? (
                    <VerifiedInformationItem key={`verified-${entry.id}`} item={entry.item} />
                  ) : (
                    <li
                      key={`note-${entry.id}`}
                      className="rounded-lg border border-[#E5E7EB] bg-[#FCFCFD] px-3 py-2.5 text-sm text-[#344054]"
                    >
                      <p>{entry.note.body}</p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        {entry.note.author_name} · {formatWhen(entry.note.created_at)}
                      </p>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[#667085]">No notes or verified information yet.</p>
            )}
          </section>

          <section className={CARD}>
            <SidebarSectionHeader
              title="Verified information"
              subtitle="Stored as recruiter-confirmed evidence."
            />
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#667085]">
                  Add new
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <Field label="Category">
                      <select
                        value={verifiedCategory}
                        onChange={(event) =>
                          setVerifiedCategory(event.target.value as VerifiedInfoCategory)
                        }
                        className={SELECT_FIELD}
                        style={{ backgroundImage: SELECT_CHEVRON }}
                      >
                        {VERIFIED_INFO_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {VERIFIED_INFO_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Title">
                      <input
                        value={verifiedTitle}
                        onChange={(event) => setVerifiedTitle(event.target.value)}
                        className={FIELD}
                        placeholder="License, certification, availability…"
                      />
                    </Field>
                  </div>
                  <Field label="Details">
                    <textarea
                      value={verifiedDetails}
                      onChange={(event) => setVerifiedDetails(event.target.value)}
                      rows={3}
                      className={AREA}
                      placeholder="Additional verified details…"
                    />
                  </Field>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`${PRIMARY_BTN} mt-4 w-full`}
              disabled={savingVerified}
              onClick={() => void addVerified()}
            >
              {savingVerified ? "Saving…" : "Add Verified Information"}
            </button>
          </section>

          <section className={CARD}>
            <SidebarSectionHeader
              title="Final Decision"
              subtitle="Kept separate from the AI recommendation."
            />
            <div className="mt-4 rounded-lg bg-[#EFF8FF] px-3 py-2.5 text-sm text-[#175CD3]">
              AI Recommendation: <span className="font-semibold">{recommendation}</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {decisionOptions.map((option) => {
                const selected = decision === option;
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-2.5 text-sm text-[#344054]">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
                          : "border-[#D0D5DD] bg-white"
                      }`}
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                    <input
                      type="radio"
                      name="final-decision"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setDecision(option)}
                    />
                    {RECRUITER_DECISION_LABELS[option]}
                  </label>
                );
              })}
            </div>
            <textarea
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
              rows={3}
              placeholder="Decision notes (optional)..."
              className={`${AREA} mt-4`}
            />
            <button
              type="button"
              className={`${PRIMARY_BTN} mt-3 w-full`}
              disabled={savingDecision}
              onClick={() => void recordDecision()}
            >
              {savingDecision ? "Saving…" : "Record Decision"}
            </button>
          </section>

          <section className={CARD}>
            <SidebarSectionHeader title="Analysis history" />
            {analysisHistory.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {analysisHistory.map((item) => (
                  <AnalysisHistoryItem key={item.id} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[#667085]">No previous analysis versions.</p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
            <button
              type="button"
              onClick={openResumeHistory}
              className={`${OUTLINE_BTN} w-full text-center`}
            >
              Update Resume
            </button>
            <button
              type="button"
              className={`${OUTLINE_BTN} w-full`}
              disabled={downloadingAssessment || !isAnalyzed}
              onClick={handleDownloadAssessment}
            >
              {downloadingAssessment ? "Downloading…" : "Download Assessment"}
            </button>
            <button
              type="button"
              className={`${OUTLINE_BTN} min-[400px]:col-span-2 w-full`}
              disabled={removingFromJob}
              onClick={openRemoveFromJobConfirm}
            >
              Remove from job
            </button>
          </div>
        </aside>
      </div>

      {/* Hidden file input for resume re-upload */}
      <input
        ref={resumeInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => void handleResumeFileSelected(e.target.files?.[0])}
      />

      <ResumeHistoryModal
        open={resumeHistoryOpen}
        jobTitle={jobTitle}
        resumes={resumeHistoryItems}
        loading={resumeHistoryLoading}
        error={resumeHistoryError}
        busyResumeId={resumeHistoryBusyId}
        reuploadBusy={resumeUploading}
        reuploadDisabled={false}
        reuploadDisabledReason={null}
        onClose={() => {
          if (resumeUploading || resumeHistoryBusyId) return;
          setResumeHistoryOpen(false);
        }}
        onReupload={beginReuploadResume}
        onView={viewResumeFromHistory}
        onDelete={deleteResumeFromHistory}
        onParse={parseResumeFromHistory}
      />

      <RemoveFromJobConfirmModal
        open={removeConfirmOpen}
        busy={removingFromJob}
        error={removeError}
        onCancel={() => {
          if (removingFromJob) return;
          setRemoveConfirmOpen(false);
          setRemoveError(null);
        }}
        onConfirm={() => void confirmRemoveFromJob()}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

function NoteBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: readonly string[];
  empty?: string;
}) {
  return (
    <div>
      <h3 className="font-semibold text-[#101828]">{title}</h3>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">{empty ?? "None."}</p>
      )}
    </div>
  );
}
