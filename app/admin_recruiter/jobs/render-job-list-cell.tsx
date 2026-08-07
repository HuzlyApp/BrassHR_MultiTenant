import type { ReactNode } from "react"
import Link from "next/link"
import { MoreHorizontal } from "lucide-react"
import type { JobColumnId, JobSortField } from "./job-columns"
import JobPublishToggle from "./JobPublishToggle"
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing"
import { JobPublicViewLink } from "./JobPublicViewLink"

const JOB_CANDIDATE_COUNTER_CLASS =
  "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-sm bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] px-1 text-[11px] font-medium leading-none text-[#475569]"

const JOB_CANDIDATE_ICONS = {
  all: "/fluent_people-28-regular.svg",
  new: "/fluent_person-add-24-regular.svg",
  matches: "/fluent_person-star-24-regular.svg",
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
  const counter = <span className={JOB_CANDIDATE_COUNTER_CLASS}>{count}</span>

  return (
    <div className="flex items-center gap-1.5">
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
      {href ? (
        <Link href={href} className="inline-flex transition hover:opacity-80">
          {counter}
        </Link>
      ) : (
        counter
      )}
    </div>
  )
}

export type JobListRow = {
  id: string
  internal_requisition_number: string | null
  public_title: string | null
  public_job_token?: string | null
  employment_type: string
  source_type?: "Internal" | "MSP" | string | null
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

export function applicantCount(job: JobListRow): number {
  return job.job_applications?.[0]?.count ?? 0
}

export function newApplicantCount(job: JobListRow): number {
  return job.new_application_count ?? 0
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
      return (job.public_title || "").trim().toLowerCase()
    // case "jobId":
    //   return jobDisplayId(job).toLowerCase()
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
  switch (status) {
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
  return status === "published"
}

function isPublishToggleDisabled(job: JobListRow): boolean {
  if (job.status === "archived") return true
  if (job.status === "closed") {
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

function publicJobPathFor(job: JobListRow, tenantSlug: string | null): string | null {
  if (job.status !== "published") return null
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
              {job.public_title || "Untitled draft"}
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
    case "candidates":
      return (
        <div className="box-border flex h-[58px] w-[350px] max-w-full items-center justify-between px-[14px]">
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.all}
            label="All"
            count={totalCandidates}
            href={`/admin_recruiter/applications?jobId=${encodeURIComponent(job.id)}`}
          />
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.new}
            label="New"
            count={newApplicantCount(job)}
            href={`/admin_recruiter/applications?jobId=${encodeURIComponent(job.id)}&tab=new`}
          />
          <JobCandidateMetric iconSrc={JOB_CANDIDATE_ICONS.matches} label="Matches" count={0} />
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
    case "location":
      return <span className="text-sm text-[#475569]">{jobLocation(job)}</span>
    case "placementType":
      return (
        <span className="text-sm text-[#475569]">{jobPlacementType(job) || "—"}</span>
      )
    case "employmentType":
      return <span className="text-sm text-[#475569]">{job.employment_type || "—"}</span>
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
