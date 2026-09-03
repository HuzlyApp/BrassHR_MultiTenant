import type { ReactNode } from "react"
import Link from "next/link"
import { Mail, Phone } from "lucide-react"
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar"
import { CandidateProfileIconLink } from "./CandidateProfileIconLink"
import { candidateMailHref, candidateProfileHref } from "./candidate-links"
import type { CandidateColumnId } from "./column-config"
import type { CandidateRow } from "./types"
import { candidateStatusBadgeClassName } from "./candidate-status-badge"
import { CandidateProgressStatusCell } from "./CandidateProgressStatusCell"
import type { ApplicationStatusOption } from "../applications/ApplicationStatusUi"
import { MatchScoreCell, RequirementOutcomeCountCell } from "@/app/admin_recruiter/applications/MatchAnalysisPanel"
import { resolveCandidateMatchJobTitle } from "@/lib/admin/candidate-match-job-title"
import { applicationCurrentStageMeta } from "@/lib/jobs/application-status"

const LINK_CLASS =
  "truncate text-left transition hover:text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"

export function renderListCell(
  col: CandidateColumnId,
  c: CandidateRow,
  formatDate: (iso: string | null) => string,
  options?: {
    highlightMultiJob?: boolean
    matchAnalyzingApplicationIds?: Set<string>
    onAnalyzeMatch?: (applicationId: string) => void
    progressStatusOptions?: ApplicationStatusOption[]
    progressStatusMenuWorkerId?: string | null
    progressStatusBusyWorkerId?: string | null
    onToggleProgressStatusMenu?: (workerId: string, anchor: HTMLButtonElement) => void
  }
): ReactNode {
  const highlightMultiJob = options?.highlightMultiJob ?? false;
  const matchAnalyzingApplicationIds = options?.matchAnalyzingApplicationIds;
  const onAnalyzeMatch = options?.onAnalyzeMatch;
  const appliedJobCount = Number(c.appliedJobCount ?? 1);

  switch (col) {
    case "name": {
      const jobTitle = resolveCandidateMatchJobTitle(c) || c.role?.trim() || ""
      return (
        <div className="flex w-full min-w-0 items-center gap-3">
          <CandidateListAvatar name={c.name || "NA"} photoUrl={c.profilePhotoUrl} />
          <div className="min-w-0 flex-1">
            {c.name?.trim() ? (
              <Link
                href={candidateProfileHref(c.id)}
                className={`block text-sm font-semibold leading-5 ${LINK_CLASS}`}
                style={{ color: "var(--brand-secondary)" }}
              >
                {c.name}
              </Link>
            ) : (
              <div className="truncate text-sm font-semibold leading-5" style={{ color: "var(--brand-secondary)" }}>
                —
              </div>
            )}
            {highlightMultiJob && appliedJobCount > 1 ? (
              <span className="mt-1 inline-flex rounded-[4px] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium leading-4 text-[color:var(--brand-primary)]">
                Applied to {appliedJobCount} jobs
              </span>
            ) : null}
            <p className="mt-0.5 truncate text-[11px] leading-4 text-[#64748B]" title={jobTitle || undefined}>
              {jobTitle || "—"}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <CandidateProfileIconLink workerId={c.id} candidateName={c.name} from="candidates" />
          </div>
        </div>
      )
    }
    case "contact": {
      const email = c.email?.trim() ?? ""
      const phone = c.phone?.trim() ?? ""
      return (
        <div className="flex min-w-0 flex-col gap-1 text-left">
          {email ? (
            <Link
              href={candidateMailHref(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Compose mail to ${c.name || email}`}
              title={email}
              className="flex min-w-0 items-center gap-1.5 text-sm leading-5 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"
              style={{ color: "var(--brand-primary)" }}
            >
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{email}</span>
            </Link>
          ) : (
            <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5" style={{ color: "var(--brand-primary)" }}>
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">—</span>
            </p>
          )}
          <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5">
            <Phone
              className="h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              style={{ color: "var(--brand-primary)" }}
              aria-hidden
            />
            <span className="truncate text-[#374151]">{phone || "—"}</span>
          </p>
        </div>
      )
    }
    case "status":
      return (
        <div className="flex w-full justify-center">
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-xl px-2.5 py-0.5 text-sm font-medium ${candidateStatusBadgeClassName(c.status)}`}
          >
            {c.status}
          </span>
        </div>
      )
    case "progressStatus":
      return (
        <CandidateProgressStatusCell
          row={c}
          options={options?.progressStatusOptions ?? []}
          menuOpen={options?.progressStatusMenuWorkerId === c.id}
          busy={options?.progressStatusBusyWorkerId === c.id}
          onToggleMenu={(anchor) => options?.onToggleProgressStatusMenu?.(c.id, anchor)}
        />
      )
    case "reference":
      return <span className="text-sm text-[#374151]">{c.reference}</span>
    case "jobRole":
      return <span className="text-sm text-[#374151]">{c.role}</span>
    case "matchJob": {
      const title = resolveCandidateMatchJobTitle(c)
      return title ? (
        <p className="whitespace-nowrap text-center text-xs leading-4 text-[#64748B]" title={title}>
          {title}
        </p>
      ) : (
        <span className="text-sm text-[#94A3B8]">—</span>
      )
    }
    case "jobMatch": {
      const applicationId = c.matchApplicationId?.trim() ?? "";
      if (!applicationId) {
        return <span className="text-sm text-[#94A3B8]">—</span>;
      }
      return (
        <MatchScoreCell
          status={c.aiMatchStatus}
          score={c.aiMatchScore}
          category={c.aiMatchCategory}
          displayCategory={c.aiMatchDisplayCategory}
          analyzing={Boolean(applicationId && matchAnalyzingApplicationIds?.has(applicationId))}
          onAnalyze={onAnalyzeMatch ? () => onAnalyzeMatch(applicationId) : undefined}
        />
      )
    }
    case "conf":
      return (
        <RequirementOutcomeCountCell
          tone="conf"
          analyzed={c.aiMatchStatus === "ANALYZED"}
          value={c.aiRequirementCounts?.confirmed}
        />
      )
    case "verify":
      return (
        <RequirementOutcomeCountCell
          tone="verify"
          analyzed={c.aiMatchStatus === "ANALYZED"}
          value={c.aiRequirementCounts?.verify}
        />
      )
    case "notMet":
      return (
        <RequirementOutcomeCountCell
          tone="notMet"
          analyzed={c.aiMatchStatus === "ANALYZED"}
          value={c.aiRequirementCounts?.notMet}
        />
      )
    case "currentStage": {
      const statusKey = c.progressStatusKey?.trim()
      if (!statusKey && !c.progressStatusApplicationId) {
        return <span className="text-sm text-[#94A3B8]">—</span>
      }
      const stage = applicationCurrentStageMeta(statusKey || "new")
      const note = stage.subtitle
      return (
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold leading-5 text-[#0F172A]">{stage.label}</p>
          {note ? (
            <p className="truncate text-xs leading-4 text-[#64748B]" title={note}>
              {note}
            </p>
          ) : null}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full"
              style={{ width: `${stage.progress}%`, backgroundColor: stage.barColor }}
            />
          </div>
        </div>
      )
    }
    case "evaluation": {
      const applicationId = c.matchApplicationId?.trim() ?? ""
      if (!applicationId) {
        return <span className="text-sm text-[#94A3B8]">—</span>
      }
      const analyzing =
        Boolean(matchAnalyzingApplicationIds?.has(applicationId)) ||
        c.aiMatchStatus === "ANALYZING"
      const analyzed = c.aiMatchStatus === "ANALYZED"
      return (
        <span
          className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${
            analyzing
              ? "bg-[#F1F5F9] text-[#64748B]"
              : analyzed
                ? "bg-[#EFF6FF] text-[#2563EB]"
                : "bg-[#F1F5F9] text-[#64748B]"
          }`}
        >
          {analyzing ? "Analyzing…" : analyzed ? "Analyzed" : "Not Yet"}
        </span>
      )
    }
    case "createdDate":
      return <span className="text-sm text-[#374151]">{formatDate(c.createdAt)}</span>
    case "location":
      return <span className="whitespace-nowrap text-sm text-[#4B5563]">{c.address || "—"}</span>
    case "city":
      return <span className="text-sm text-[#4B5563]">{c.city || "—"}</span>
    case "zipCode":
      return <span className="text-sm text-[#4B5563]">{c.zip || "—"}</span>
    case "state":
      return <span className="text-sm text-[#4B5563]">{c.state || "—"}</span>
    case "address1":
      return <span className="text-sm text-[#4B5563]">{c.address1 || "—"}</span>
    case "phone":
      return <span className="text-sm text-[#4B5563]">{c.phone || "—"}</span>
    case "email":
      return c.email?.trim() ? (
        <Link
          href={candidateMailHref(c.id)}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm text-[#4B5563] ${LINK_CLASS}`}
        >
          {c.email}
        </Link>
      ) : (
        <span className="text-sm text-[#4B5563]">—</span>
      )
    case "dateOfBirth":
      return <span className="text-sm text-[#4B5563]">{c.dateOfBirth ? formatDate(c.dateOfBirth) : "—"}</span>
    case "firstName":
      return <span className="text-sm text-[#4B5563]">{c.firstName || "—"}</span>
    case "lastName":
      return <span className="text-sm text-[#4B5563]">{c.lastName || "—"}</span>
    default:
      return <span className="text-sm text-[#4B5563]">—</span>
  }
}
