"use client";

import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  formatMatchCategory,
  formatMatchScore,
  formatRecommendedAction,
  matchCategoryBadgeClassName,
} from "@/lib/jobs/match-analysis/display";
import {
  RECRUITER_DECISION_LABELS,
  filterQualificationRequirements,
  qualificationDisplayStatus,
  recruiterActionLabel,
  type QualificationDisplayStatus,
  type QualificationFilter,
  type QualificationRequirement,
} from "@/lib/jobs/match-analysis/workspace";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
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
  "inline-flex items-center justify-center rounded-xl border-2 border-[color:var(--brand-secondary)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--brand-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
const HEADER_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-xl bg-[color:var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const SIDEBAR_SAVE_BTN =
  "inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[color:var(--brand-primary)] px-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60";
const SIDEBAR_REEXTRACT_BTN =
  "inline-flex h-10 w-[214px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border-2 border-[color:var(--brand-secondary)] bg-white px-3 text-sm font-semibold text-[color:var(--brand-secondary)] transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)]";
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

function MatchRing({ percent, label, strokeColor }: { percent: number; label: string; strokeColor: string }) {
  const size = 121;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
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
          <span className="h-[34px] text-[28px] font-bold leading-[34px] text-[#101828]">{percent}%</span>
          <span className="text-xs font-normal leading-4 text-[#667085]">{label}</span>
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

function formatRequirementType(type: string): string {
  const normalized = type.trim().toLowerCase();
  if (normalized === "mandatory") return "Mandatory";
  if (normalized === "preferred") return "Preferred";
  return type;
}

function typeBadgeClass(type: string) {
  return formatRequirementType(type) === "Mandatory"
    ? "bg-[#DCFCE7] text-[#166534]"
    : "bg-[#E0F2FE] text-[#075985]";
}

function statusBadgeClass(status: QualificationDisplayStatus) {
  if (status === "Confirmed") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (status === "Blocking") return "bg-[#FEE2E2] text-[#991B1B]";
  if (status === "Not Met") return "bg-[#FFEDD5] text-[#9A3412]";
  return "bg-[#FEF9C3] text-[#854D0E]";
}

function ringStrokeColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(Number(score))) return "#E5E7EB";
  const n = Number(score);
  if (n >= 75) return "#22C55E";
  if (n >= 50) return "#3B82F6";
  if (n >= 25) return "#F59E0B";
  return "#EF4444";
}

export function AiAnalysisOverviewClient({
  applicationId,
  backHref,
  jobId,
}: AiAnalysisOverviewClientProps) {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const workspace = useMatchAnalysisWorkspace(applicationId);
  const {
    loading,
    analyzing,
    data,
    analysis,
    blocking,
    verifyItems,
    isAnalyzed,
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

  const app = data?.application;
  const matchScore = app?.ai_match_score ?? 0;
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
  const latestHistory = data?.analysisHistory?.[0];

  useEffect(() => {
    if (!openReqId && data?.requirements?.[0]?.id) {
      setOpenReqId(data.requirements[0].id);
    }
  }, [data?.requirements, openReqId]);

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
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
        style={{ color: branding.secondaryHex }}
      >
        <span
          aria-hidden
          className="inline-block h-[14px] w-[14px] shrink-0 bg-current"
          style={{
            maskImage: "url(/eva_arrow-back-fill.svg)",
            WebkitMaskImage: "url(/eva_arrow-back-fill.svg)",
            maskSize: "contain",
            WebkitMaskSize: "contain",
          }}
        />
        Back to candidates
      </Link>

      <h1 className={`${CANDIDATES_PAGE_TITLE_CLASS} mt-4`} style={CANDIDATES_PAGE_TITLE_STYLE}>
        AI Analysis Overview
      </h1>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-[12px] border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-5 px-5 py-2.5">
              <MatchRing
                percent={Math.round(Number(matchScore) || 0)}
                label={matchLabel}
                strokeColor={ringStrokeColor(matchScore)}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-semibold leading-7 text-[#101828]">{candidateName}</h2>
                <p className="mt-1 text-sm leading-5 text-[#667085]">For: {jobTitle}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${matchCategoryBadgeClassName(app?.ai_match_category)}`}
                  >
                    {matchLabel}
                  </span>
                  {confidencePercent != null ? (
                    <span className="inline-flex rounded-full bg-[#012352] px-2.5 py-1 text-xs font-semibold text-white">
                      Confidence {confidencePercent}%
                    </span>
                  ) : null}
                  <span className="inline-flex rounded-full bg-[#E4E7EC] px-2.5 py-1 text-xs font-semibold text-[#344054]">
                    {recommendation}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button type="button" className={HEADER_OUTLINE_BTN}>
                  Attempted Contacted
                </button>
                <button
                  type="button"
                  className={HEADER_PRIMARY_BTN}
                  disabled={analyzing}
                  onClick={() => void runAnalyze()}
                >
                  {analyzing ? "Analyzing…" : isAnalyzed ? "Reanalyze" : "Analyze candidate"}
                </button>
              </div>
            </div>
            {app?.ai_analysis_error ? (
              <p className="px-5 pt-2 text-sm text-[#B91C1C]">{app.ai_analysis_error}</p>
            ) : null}
            {summary ? (
              <p className="px-5 pb-2.5 pt-2 text-sm leading-6 text-[#344054]">{summary}</p>
            ) : !isAnalyzed ? (
              <p className="px-5 pb-2.5 pt-2 text-sm leading-6 text-[#667085]">
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
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => {
                  const active = filter === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
              <label className="relative w-full max-w-[260px]">
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
                    <th className="py-3 pr-3">Requirement</th>
                    <th className="py-3 pr-3">Type</th>
                    <th className="py-3 pr-3">Status</th>
                    <th className="py-3">Action</th>
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
                        <tr className={open ? "" : "border-b border-[#F2F4F7]"}>
                          <td className="py-3.5 pr-3">
                            <p className="text-sm font-medium leading-5 text-[#101828]">{row.requirement_text}</p>
                          </td>
                          <td className="py-3.5 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${typeBadgeClass(row.requirement_type)}`}
                            >
                              {formatRequirementType(row.requirement_type)}
                            </span>
                          </td>
                          <td className="py-3.5 pr-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(displayStatus)}`}
                            >
                              {displayStatus}
                            </span>
                          </td>
                          <td className="py-3.5 text-sm text-[#475467]">{actionLabel}</td>
                          <td className="py-3.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"
                              aria-expanded={open}
                              aria-label={open ? "Collapse requirement" : "Expand requirement"}
                              onClick={() => setOpenReqId(open ? "" : row.id)}
                              disabled={!row.candidate_evidence}
                            >
                              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                        {open && row.candidate_evidence ? (
                          <tr className="border-b border-[#F2F4F7]">
                            <td colSpan={5} className="pb-4 pr-3">
                              <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                                  Candidate Evidence
                                </p>
                                <blockquote className="mt-2 border-l-[3px] border-[color:var(--brand-primary)] pl-3 text-sm italic leading-6 text-[#344054]">
                                  {row.candidate_evidence}
                                </blockquote>
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]">
                                  <button
                                    type="button"
                                    className="font-medium text-[color:var(--brand-primary)] hover:underline"
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
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-[#344054]">
                      <img
                        src="/icon-park-solid_check-one.svg"
                        alt=""
                        className="h-[18px] w-[18px] shrink-0"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
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
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-[#344054]">
                      <img
                        src="/ic_round-warning.svg"
                        alt=""
                        className="h-[18px] w-[18px] shrink-0"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
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
                <button
                  type="button"
                  className={`${OUTLINE_BTN} h-10 gap-2 px-3`}
                  onClick={() => {
                    if (!recommendedQuestions.length) {
                      toast.error("No screening questions to copy.");
                      return;
                    }
                    copyText(
                      recommendedQuestions.map((item, index) => `${index + 1}. ${item.question}`).join("\n\n"),
                      "Questions copied"
                    );
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy all
                </button>
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
            <div className="mt-4 flex items-center gap-2">
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
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-3">
              <BrandedFileTypeIcon type="pdf" className="h-7 w-7" />
              <span className="truncate text-sm font-medium text-[#344054]">
                {data?.extractedResume?.fileName || "Resume"}
              </span>
            </div>
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
            <button
              type="button"
              className={`${PRIMARY_BTN} mt-3`}
              disabled={savingText}
              onClick={() => void saveExtractedText()}
            >
              {savingText ? "Saving…" : "Save extracted text"}
            </button>
          </section>

          <section className={CARD}>
            <SidebarSectionHeader
              title="Verified information"
              subtitle="Stored as recruiter-confirmed evidence."
            />
            <div className="mt-4 space-y-3">
              {(data?.verifiedInformation ?? []).length ? (
                <ul className="space-y-2">
                  {data?.verifiedInformation?.map((item) => (
                    <li key={item.id} className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm">
                      <p className="font-medium text-[#101828]">{item.title}</p>
                      {item.details ? <p className="text-[#475467]">{item.details}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Field label="Title">
                <input
                  value={verifiedTitle}
                  onChange={(event) => setVerifiedTitle(event.target.value)}
                  className={FIELD}
                  placeholder="License, certification, availability…"
                />
              </Field>
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
              title="Notes"
              subtitle="Visible to recruiters in this workspace."
            />
            {(data?.notes ?? []).length ? (
              <ul className="mt-4 space-y-2">
                {data?.notes?.map((note) => (
                  <li key={note.id} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#344054]">
                    <p>{note.body}</p>
                    <p className="mt-1 text-xs text-[#94A3B8]">
                      {note.author_name} · {formatWhen(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[#667085]">No notes yet.</p>
            )}
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
            {latestHistory ? (
              <>
                <p className="mt-4 text-xl font-semibold text-[#101828]">
                  {formatMatchScore(latestHistory.score)} ·{" "}
                  {latestHistory.display_category || formatMatchCategory(latestHistory.category)}
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  {formatWhen(latestHistory.analyzed_at)}
                  {latestHistory.model ? ` · ${latestHistory.model}` : ""}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-[#667085]">No previous analysis versions.</p>
            )}
            {(data?.analysisHistory?.length ?? 0) > 1 ? (
              <ul className="mt-4 space-y-2 border-t border-[#E5E7EB] pt-4">
                {data?.analysisHistory?.slice(1).map((item) => (
                  <li key={item.id} className="text-sm text-[#475467]">
                    Version {item.version} · {formatMatchScore(item.score)} ·{" "}
                    {item.display_category || formatMatchCategory(item.category)}
                    <span className="mt-0.5 block text-xs text-[#94A3B8]">{formatWhen(item.analyzed_at)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href={
                jobId
                  ? `/admin_recruiter/applications/review?jobId=${encodeURIComponent(jobId)}&applicationId=${encodeURIComponent(applicationId)}`
                  : `/admin_recruiter/applications/review?applicationId=${encodeURIComponent(applicationId)}`
              }
              className={`${OUTLINE_BTN} w-full text-center`}
            >
              Update Resume
            </Link>
            <button type="button" className={`${OUTLINE_BTN} w-full`}>
              Download Assessment
            </button>
            <button type="button" className={`${OUTLINE_BTN} col-span-2 w-full`}>
              Remove from job
            </button>
          </div>
        </aside>
      </div>
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
