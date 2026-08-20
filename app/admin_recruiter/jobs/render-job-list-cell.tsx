import type { ReactNode } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import type { JobColumnId, JobSortField } from "./job-columns"
import JobPublishToggle from "./JobPublishToggle"
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing"
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status"
import { isMspRecruitAndRelease, placementTypeFromApiRow } from "@/lib/jobs/placement"
import type { SourceType } from "@/lib/jobs/types"
import { employmentTypeDisplayLabel } from "@/lib/jobs/employment-type"
import { JobPublicViewLink } from "./JobPublicViewLink"
import { DraftJobIncompleteInfoIcon } from "./DraftJobIncompleteInfoIcon"

const JOB_CANDIDATE_COUNTER_CLASS =
  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sm bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] px-1 text-[11px] font-medium leading-none text-[#475569]"

const JOB_CANDIDATE_ICONS = {
  all: "/fluent_people-28-regular.svg",
  new: "/fluent_person-add-24-regular.svg",
  hired: "/fluent_person-star-24-regular.svg",
} as const

/** Figma jobs list star — 14×14 */
const JOB_STAR_ICON_SIZE = 14
const JOB_STAR_FILLED_SRC = "/icons/jobs-icons/Star-filled.svg"

function JobCandidateMetric({
  iconSrc,
  label,
  count,
  href,
}: {
  iconSrc: string
  label: string
  count: number
  href?: string
}) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={iconSrc}
        alt=""
        width={12}
        height={12}
        className="h-[12px] w-[12px] shrink-0 object-contain"
        aria-hidden
      />
      <span className="text-xs font-normal text-[#475569]">{label}</span>
      <span className={JOB_CANDIDATE_COUNTER_CLASS}>{count}</span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="flex cursor-pointer items-center gap-1.5 rounded-md transition hover:opacity-80"
        aria-label={`${label} ${count}`}
      >
        {body}
      </Link>
    )
  }

  return <div className="flex items-center gap-1.5">{body}</div>
}

export type JobListRow = {
  id: string
  internal_requisition_number: string | null
  public_title: string | null
  public_job_token?: string | null
  employment_type: string
  source_type?: "Internal" | "MSP" | string | null
  placement_type?: string | null
  /** MSP R&R / EOR: source job title from Job Source Details. */
  source_job_title?: string | null
  /** MSP R&R commission fee fields. */
  commission_percent?: number | null
  commission_fixed_amount?: number | null
  /** MSP (Job Source) — shown as Contract Group for MSP jobs. */
  msp_name?: string | null
  msp_client?: string | null
  status: "draft" | "published" | "closed" | "archived"
  created_at: string
  published_at: string | null
  location: string | null
  facility: string | null
  facility_name: string | null
  application_deadline: string | null
  pay_rate_min?: number | null
  pay_rate_max?: number | null
  pay_rate_period?: string | null
  rate_unit?: string | null
  pay_rate?: number | null
  location_type?: string | null
  schedule?: string | null
  shift_type?: string | null
  professions: { name?: string } | { name?: string }[] | null
  specialties: { name?: string } | { name?: string }[] | null
  onboarding_flows: { name?: string } | { name?: string }[] | null
  job_applications: { count?: number }[] | null
  /** Candidates with status new/submitted — from listInternalJobs. */
  new_application_count?: number
  /** Applications with completed AI match analysis. */
  analyzed_application_count?: number
  /** Applications whose AI match score is 90% or higher. */
  strong_match_count?: number
  /** Analyzed applications ready to submit. */
  ready_to_submit_count?: number
  /** Applications with hired status. */
  hired_application_count?: number
}

const JOB_FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white"

function relationName(value: JobListRow["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value
  return row?.name ?? ""
}

export function jobProfession(job: JobListRow): string {
  return relationName(job.professions)
}

/** Employment type chips (shift_type) — jobs listing filter. */
export function jobShiftType(job: JobListRow): string {
  return job.shift_type?.trim() || ""
}

/** Contract Group for MSP jobs (MSP / job source name). */
export function jobContractGroup(job: JobListRow): string {
  const source = String(job.source_type ?? "").trim().toLowerCase()
  if (source !== "msp") return ""
  return job.msp_name?.trim() || job.msp_client?.trim() || ""
}

function jobListSourceType(job: JobListRow): SourceType {
  const raw = String(job.source_type ?? "").trim().toLowerCase()
  return raw === "msp" ? "MSP" : "Internal"
}

export function isJobListMspRecruitAndRelease(job: JobListRow): boolean {
  return isMspRecruitAndRelease({
    sourceType: jobListSourceType(job),
    placementType: placementTypeFromApiRow(
      jobListSourceType(job),
      job.placement_type,
      job.employment_type
    ),
  })
}

/** Job Title column: MSP uses Source Job Title; Internal uses public title. */
export function jobListDisplayTitle(job: JobListRow): string {
  const source = String(job.source_type ?? "").trim().toLowerCase()
  if (source === "msp") {
    return (
      job.source_job_title?.trim() ||
      job.public_title?.trim() ||
      "Untitled draft"
    )
  }
  return job.public_title?.trim() || "Untitled draft"
}

export function formatJobListCommissionFeeText(job: JobListRow): string {
  if (!isJobListMspRecruitAndRelease(job)) return "—"
  const parts: string[] = []
  const percent = toNumberOrNull(job.commission_percent)
  const fixed = toNumberOrNull(job.commission_fixed_amount)
  if (percent != null && percent > 0) {
    parts.push(`${formatPayAmount(percent)}%`)
  }
  if (fixed != null && fixed > 0) {
    parts.push(`$${formatPayAmount(fixed)} USD`)
  }
  return parts.length ? parts.join(" + ") : "—"
}

export function jobCommissionFeeSortValue(job: JobListRow): number {
  if (!isJobListMspRecruitAndRelease(job)) return -1
  const percent = toNumberOrNull(job.commission_percent)
  const fixed = toNumberOrNull(job.commission_fixed_amount)
  if (percent != null && percent > 0) return percent
  if (fixed != null && fixed > 0) return fixed
  return -1
}

export function applicantCount(job: JobListRow): number {
  return job.job_applications?.[0]?.count ?? 0
}

export function newApplicantCount(job: JobListRow): number {
  return job.new_application_count ?? 0
}

export function analyzedApplicantCount(job: JobListRow): number {
  return job.analyzed_application_count ?? 0
}

export function strongMatchCount(job: JobListRow): number {
  return job.strong_match_count ?? 0
}

export function readyToSubmitCount(job: JobListRow): number {
  return job.ready_to_submit_count ?? 0
}

export function hiredApplicantCount(job: JobListRow): number {
  return job.hired_application_count ?? 0
}

export function jobCandidatesHref(jobId: string): string {
  return `/admin_recruiter/applications?jobId=${encodeURIComponent(jobId)}`
}

export function jobHiredCandidatesHref(jobId: string): string {
  return `${jobCandidatesHref(jobId)}&tab=hired`
}

export function jobLocation(job: JobListRow): string {
  return (
    job.location?.trim() ||
    job.facility_name?.trim() ||
    job.facility?.trim() ||
    relationName(job.specialties) ||
    "—"
  )
}

export function jobPlacementType(job: JobListRow): string {
  return job.location_type?.trim() || job.schedule?.trim() || ""
}

export function jobDisplayId(job: JobListRow): string {
  return job.internal_requisition_number?.trim() || job.id.slice(0, 8).toUpperCase()
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatPayAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "")
}

/** Normalize DB / form period labels to Figma style unit (e.g. "hour"). */
export function jobPayRatePeriodLabel(job: JobListRow): string {
  const raw = String(job.pay_rate_period || job.rate_unit || "").trim().toLowerCase()
  if (!raw) return ""
  if (raw.includes("hour")) return "hour"
  if (raw.includes("day")) return "day"
  if (raw.includes("week")) return "week"
  if (raw.includes("month")) return "month"
  if (raw.includes("year") || raw.includes("annual")) return "year"
  if (raw.includes("flat")) return "flat"
  return raw.replace(/^per\s+/i, "").trim()
}

export function jobPayRateSortValue(job: JobListRow): number {
  const suggested = toNumberOrNull(job.pay_rate)
  if (suggested != null) return suggested
  const min = toNumberOrNull(job.pay_rate_min)
  const max = toNumberOrNull(job.pay_rate_max)
  if (min != null && max != null) return Math.min(min, max)
  if (min != null) return min
  if (max != null) return max
  return -1
}

/** Plain-text pay rate for export / aria (e.g. "$50 / hour"). */
export function formatJobListPayRateText(job: JobListRow): string {
  const parts = formatJobListPayRateParts(job)
  if (!parts) return "—"
  return parts.period ? `${parts.amount} / ${parts.period}` : parts.amount
}

export function formatJobListPayRateParts(
  job: JobListRow
): { amount: string; period: string } | null {
  const suggested = toNumberOrNull(job.pay_rate)
  const min = toNumberOrNull(job.pay_rate_min)
  const max = toNumberOrNull(job.pay_rate_max)
  const period = jobPayRatePeriodLabel(job)

  let amount = ""
  if (suggested != null) {
    amount = `$${formatPayAmount(suggested)}`
  } else if (min != null && max != null) {
    amount =
      min === max
        ? `$${formatPayAmount(min)}`
        : `$${formatPayAmount(min)} - $${formatPayAmount(max)}`
  } else if (min != null) {
    amount = `$${formatPayAmount(min)}`
  } else if (max != null) {
    amount = `$${formatPayAmount(max)}`
  }

  if (!amount) return null
  return { amount, period }
}

export function jobStatusSortLabel(status: JobListRow["status"]): string {
  switch (status) {
    case "published":
      return "Published"
    case "draft":
      return "Unpublished"
    case "closed":
      return "Closed"
    case "archived":
      return "Archived"
    default:
      return status
  }
}

export function jobSortValue(job: JobListRow, field: JobSortField): string | number {
  switch (field) {
    case "jobTitle":
      return jobListDisplayTitle(job).toLowerCase()
    // case "jobId":
    //   return jobDisplayId(job).toLowerCase()
    case "contractGroup":
      return jobContractGroup(job).toLowerCase()
    case "candidates":
      return applicantCount(job)
    case "datePosted":
      return new Date(job.published_at || job.created_at || 0).getTime() || 0
    case "assignee":
      return "hr manager"
    case "jobStatus":
      return jobStatusSortLabel(job.status).toLowerCase()
    case "payRate":
      return jobPayRateSortValue(job)
    case "commissionFee":
      return jobCommissionFeeSortValue(job)
    case "location":
      return jobLocation(job).toLowerCase()
    case "placementType":
      return jobPlacementType(job).toLowerCase()
    case "employmentType":
      return (job.employment_type || "").toLowerCase()
    case "jobType":
      return (job.shift_type || "").trim().toLowerCase()
    case "profession":
      return relationName(job.professions).toLowerCase()
    case "specialty":
      return relationName(job.specialties).toLowerCase()
    case "workflow":
      return relationName(job.onboarding_flows).toLowerCase()
    case "createdDate":
      return new Date(job.created_at || 0).getTime() || 0
    case "applicationDeadline":
      return new Date(job.application_deadline || 0).getTime() || 0
    default:
      return ""
  }
}

function displayJobStatus(status: JobListRow["status"]): { label: string; dotClass: string } {
  switch (normalizeJobRequisitionStatus(String(status ?? ""))) {
    case "published":
      return { label: "Published", dotClass: "bg-[#3B82F6]" }
    case "draft":
      return { label: "Unpublished", dotClass: "bg-[#94A3B8]" }
    case "closed":
      return { label: "Closed", dotClass: "bg-[#EF4444]" }
    case "archived":
      return { label: "Archived", dotClass: "bg-[#EF4444]" }
    default:
      return { label: jobStatusSortLabel(status), dotClass: "bg-[#94A3B8]" }
  }
}

function isPublishToggleChecked(status: JobListRow["status"]): boolean {
  return normalizeJobRequisitionStatus(String(status ?? "")) === "published"
}

function isPublishToggleDisabled(job: JobListRow): boolean {
  const status = normalizeJobRequisitionStatus(String(job.status ?? ""))
  if (status === "archived") return true
  if (status === "closed") {
    return !isJobRequisitionOpen({ application_deadline: job.application_deadline })
  }
  return false
}

function formatPostedDate(iso: string | null): { relative: string; absolute: string } {
  if (!iso) return { relative: "—", absolute: "—" }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { relative: "—", absolute: "—" }

  const absolute = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const diffMs = Date.now() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  let relative = "Just now"
  if (diffDays >= 1) relative = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
  else if (diffHours >= 1) relative = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`

  return { relative, absolute }
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export type JobListCellContext = {
  brandingSecondaryHex: string
  tenantSlug: string | null
  starredIds: Set<string>
  onToggleStar: (jobId: string) => void
  openActionsJobId: string | null
  onOpenActionsMenu: (job: JobListRow, anchor: HTMLElement) => void
  publishBusyIds: Set<string>
  onPublishToggle: (job: JobListRow) => void
}

export function publicJobPathFor(job: JobListRow, tenantSlug: string | null): string | null {
  if (normalizeJobRequisitionStatus(String(job.status ?? "")) !== "published") return null
  const token = typeof job.public_job_token === "string" ? job.public_job_token.trim() : ""
  const slug = tenantSlug?.trim().toLowerCase() ?? ""
  if (!token || !slug) return null
  return `/jobs/${encodeURIComponent(token)}?tenant=${encodeURIComponent(slug)}`
}

export function renderJobListCell(
  col: JobColumnId,
  job: JobListRow,
  ctx: JobListCellContext
): ReactNode {
  const isStarred = ctx.starredIds.has(job.id)
  const posted = formatPostedDate(job.published_at || job.created_at)
  const statusDisplay = displayJobStatus(job.status)
  const totalCandidates = applicantCount(job)

  switch (col) {
    case "jobTitle":
      return (
        <div className="flex w-full min-w-0 items-center gap-2 pr-2">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              ctx.onToggleStar(job.id);
            }}
            className="inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center"
            aria-label={isStarred ? "Unstar job" : "Star job"}
            aria-pressed={isStarred}
          >
            {isStarred ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={JOB_STAR_FILLED_SRC}
                alt=""
                width={JOB_STAR_ICON_SIZE}
                height={JOB_STAR_ICON_SIZE}
                className="h-[14px] w-[14px]"
                aria-hidden
              />
            ) : (
              <span
                aria-hidden
                className="inline-block h-[14px] w-[14px] shrink-0 bg-[#94A3B8]"
                style={{
                  maskImage: `url(${JOB_STAR_FILLED_SRC})`,
                  WebkitMaskImage: `url(${JOB_STAR_FILLED_SRC})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin_recruiter/jobs/${job.id}`}
              className="block truncate font-semibold hover:underline"
              style={{ color: ctx.brandingSecondaryHex }}
            >
              {jobListDisplayTitle(job)}
            </Link>
          </div>
          <JobPublicViewLink
            href={publicJobPathFor(job, ctx.tenantSlug)}
            className="ml-auto shrink-0"
          />
        </div>
      )
    // case "jobId":
    //   return <span className="text-sm text-[#475569]">{jobDisplayId(job)}</span>
    case "contractGroup": {
      const group = jobContractGroup(job)
      return <span className="text-sm text-[#475569]">{group || "—"}</span>
    }
    case "candidates":
      if (job.status === "draft") {
        return (
          <div className="box-border flex h-full min-h-full w-full min-w-0 items-center gap-2 bg-[#FEF2F2] px-3 py-4">
            <DraftJobIncompleteInfoIcon />
            <span className="min-w-0 flex-1 truncate text-left text-sm text-[#334155]">
              Your job post is incomplete
            </span>
            <Link
              href={`/admin_recruiter/jobs/${job.id}/edit`}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-95"
            >
              Finish posting
            </Link>
          </div>
        )
      }
      return (
        <div className="box-border flex h-[58px] w-[350px] max-w-full items-center justify-between px-[14px]">
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.all}
            label="All"
            count={totalCandidates}
            href={jobCandidatesHref(job.id)}
          />
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.new}
            label="New"
            count={newApplicantCount(job)}
            href={`${jobCandidatesHref(job.id)}&tab=new`}
          />
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.hired}
            label="Hired"
            count={hiredApplicantCount(job)}
            href={jobHiredCandidatesHref(job.id)}
          />
        </div>
      )
    case "datePosted":
      return (
        <div className="text-[#475569]">
          <div className="text-sm">{posted.relative}</div>
          <div className="mt-0.5 text-xs text-[#94A3B8]">{posted.absolute}</div>
        </div>
      )
    case "assignee":
      return (
        <div className="flex items-center justify-center gap-2">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: ctx.brandingSecondaryHex }}
          >
            HR
          </span>
          <span className="text-sm text-[#475569]">HR Manager</span>
        </div>
      )
    case "jobStatus":
      return (
        <div className="flex justify-center">
          <div
            className={`inline-flex h-8 w-fit items-center justify-center gap-2 whitespace-nowrap px-2.5 text-sm text-[#334155] ${JOB_FORM_SURFACE_CLASS}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${statusDisplay.dotClass}`} />
            {statusDisplay.label}
          </div>
        </div>
      )
    case "payRate": {
      const pay = formatJobListPayRateParts(job)
      if (!pay) {
        return <span className="mx-auto block w-fit text-sm text-[#475569]">—</span>
      }
      return (
        <div className="flex w-full justify-center">
          <span className="inline-flex items-baseline whitespace-nowrap text-sm">
            <span className="font-semibold tabular-nums text-[#1D2739]">{pay.amount}</span>
            {pay.period ? (
              <span className="font-normal text-[#475569]">{` / ${pay.period}`}</span>
            ) : null}
          </span>
        </div>
      )
    }
    case "commissionFee": {
      const commission = formatJobListCommissionFeeText(job)
      return (
        <span className="mx-auto block w-fit text-sm tabular-nums text-[#475569]">
          {commission}
        </span>
      )
    }
    case "location":
      return <span className="text-sm text-[#475569]">{jobLocation(job)}</span>
    case "placementType":
      return (
        <span className="text-sm text-[#475569]">{jobPlacementType(job) || "—"}</span>
      )
    case "employmentType":
      return (
        <span className="text-sm text-[#475569]">
          {job.employment_type ? employmentTypeDisplayLabel(job.employment_type) : "—"}
        </span>
      )
    case "jobType":
      return <span className="text-sm text-[#475569]">{job.shift_type?.trim() || "—"}</span>
    case "profession":
      return <span className="text-sm text-[#475569]">{relationName(job.professions) || "—"}</span>
    case "specialty":
      return <span className="text-sm text-[#475569]">{relationName(job.specialties) || "—"}</span>
    case "workflow":
      return (
        <span className="text-sm text-[#475569]">{relationName(job.onboarding_flows) || "—"}</span>
      )
    case "createdDate":
      return <span className="text-sm text-[#475569]">{formatDateShort(job.created_at)}</span>
    case "applicationDeadline":
      return (
        <span className="text-sm text-[#475569]">{formatDateShort(job.application_deadline)}</span>
      )
    case "actions":
      return (
        <div className="flex items-center justify-center gap-3 px-[14px] py-[10px]">
          <JobPublishToggle
            checked={isPublishToggleChecked(job.status)}
            disabled={isPublishToggleDisabled(job)}
            busy={ctx.publishBusyIds.has(job.id)}
            activeColor={ctx.brandingSecondaryHex}
            onChange={() => ctx.onPublishToggle(job)}
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              ctx.onOpenActionsMenu(job, event.currentTarget)
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#334155] transition hover:bg-[#E2E8F0]"
            aria-label="Job actions"
            aria-haspopup="menu"
            aria-expanded={ctx.openActionsJobId === job.id}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      )
    default:
      return "—"
  }
}
