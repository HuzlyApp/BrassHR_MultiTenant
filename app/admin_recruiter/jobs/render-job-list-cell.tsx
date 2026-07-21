import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, MoreVertical, Star } from "lucide-react"
import type { JobColumnId } from "./job-columns"

const JOB_CANDIDATE_COUNTER_CLASS =
  "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] px-0.5 text-[10px] font-medium leading-none text-[#475569]"

const JOB_CANDIDATE_ICONS = {
  all: "/fluent_people-28-regular.svg",
  new: "/fluent_person-add-24-regular.svg",
  matches: "/fluent_person-star-24-regular.svg",
} as const

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
      <img src={iconSrc} alt="" width={12} height={12} className="h-3 w-3 shrink-0" aria-hidden />
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
  employment_type: string
  status: "draft" | "published" | "closed" | "archived"
  created_at: string
  published_at: string | null
  location: string | null
  facility: string | null
  facility_name: string | null
  application_deadline: string | null
  professions: { name?: string } | { name?: string }[] | null
  specialties: { name?: string } | { name?: string }[] | null
  onboarding_flows: { name?: string } | { name?: string }[] | null
  job_applications: { count?: number }[] | null
}

const JOB_FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white"
const JOB_STAR_ICON_COLOR = "#EAB308"

function relationName(value: JobListRow["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value
  return row?.name ?? ""
}

export function applicantCount(job: JobListRow): number {
  return job.job_applications?.[0]?.count ?? 0
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

export function jobDisplayId(job: JobListRow): string {
  return job.internal_requisition_number?.trim() || job.id.slice(0, 8).toUpperCase()
}

function displayJobStatus(status: JobListRow["status"]): { label: string; dotClass: string } {
  switch (status) {
    case "published":
      return { label: "Open", dotClass: "bg-[#3B82F6]" }
    case "draft":
      return { label: "Drafts", dotClass: "bg-[#94A3B8]" }
    case "closed":
      return { label: "Closed", dotClass: "bg-[#EF4444]" }
    case "archived":
      return { label: "Closed", dotClass: "bg-[#EF4444]" }
    default:
      return { label: status, dotClass: "bg-[#94A3B8]" }
  }
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
  starredIds: Set<string>
  onToggleStar: (jobId: string) => void
  openActionsJobId: string | null
  onOpenActionsMenu: (job: JobListRow, anchor: HTMLElement) => void
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
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => ctx.onToggleStar(job.id)}
            className="mt-0.5 shrink-0"
            aria-label={isStarred ? "Unstar job" : "Star job"}
          >
            <Star
              className="h-4 w-4"
              style={{ color: JOB_STAR_ICON_COLOR }}
              fill={isStarred ? JOB_STAR_ICON_COLOR : "transparent"}
            />
          </button>
          <div className="min-w-0">
            <Link
              href={`/admin_recruiter/jobs/${job.id}/edit`}
              className="block truncate font-semibold hover:underline"
              style={{ color: ctx.brandingSecondaryHex }}
            >
              {job.public_title || "Untitled draft"}
            </Link>
            <p className="mt-0.5 text-xs text-[#64748B]">{jobLocation(job)}</p>
          </div>
        </div>
      )
    case "jobId":
      return <span className="text-sm text-[#475569]">{jobDisplayId(job)}</span>
    case "candidates":
      return (
        <div className="flex w-full min-w-[280px] items-center justify-between gap-3">
          <JobCandidateMetric
            iconSrc={JOB_CANDIDATE_ICONS.all}
            label="All"
            count={totalCandidates}
            href={`/admin_recruiter/applications?jobId=${job.id}`}
          />
          <JobCandidateMetric iconSrc={JOB_CANDIDATE_ICONS.new} label="New" count={0} />
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
        <div className="flex items-center gap-2">
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
        <div
          className={`inline-flex h-8 min-w-[112px] items-center justify-between gap-2 px-2.5 text-sm text-[#334155] ${JOB_FORM_SURFACE_CLASS}`}
        >
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDisplay.dotClass}`} />
            {statusDisplay.label}
          </span>
          <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
        </div>
      )
    case "location":
      return <span className="text-sm text-[#475569]">{jobLocation(job)}</span>
    case "employmentType":
      return <span className="text-sm text-[#475569]">{job.employment_type || "—"}</span>
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
        <button
          type="button"
          onClick={(event) => ctx.onOpenActionsMenu(job, event.currentTarget)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9]"
          aria-label="Job actions"
          aria-haspopup="menu"
          aria-expanded={ctx.openActionsJobId === job.id}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )
    default:
      return "—"
  }
}
