import type { ReactNode } from "react"
import Link from "next/link"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar"
import { candidateMailHref, candidateProfileHref } from "./candidate-links"
import type { CandidateColumnId } from "./column-config"
import type { CandidateRow } from "./types"
import { candidateStatusBadgeClassName } from "./candidate-status-badge"

const BRAND_ICON = "var(--brand-primary)"
const LINK_CLASS =
  "truncate text-left transition hover:text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"

export function renderListCell(
  col: CandidateColumnId,
  c: CandidateRow,
  formatDate: (iso: string | null) => string
): ReactNode {
  switch (col) {
    case "name":
      return (
        <div className="flex items-center gap-3 min-w-0 w-full">
          <CandidateListAvatar name={c.name || "NA"} photoUrl={c.profilePhotoUrl} />
          <div className="min-w-0">
            {c.name?.trim() ? (
              <Link href={candidateProfileHref(c.id)} className={`block text-sm font-medium text-black ${LINK_CLASS}`}>
                {c.name}
              </Link>
            ) : (
              <div className="text-sm font-medium text-black truncate">—</div>
            )}
            {c.email?.trim() ? (
              <Link
                href={candidateMailHref(c.id)}
                className={`block text-xs text-[#4B5563] ${LINK_CLASS}`}
              >
                {c.email}
              </Link>
            ) : (
              <div className="text-xs text-[#4B5563] truncate">—</div>
            )}
          </div>
          
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Link
              href={`/admin_recruiter/new/attachments/${c.id}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]"
              aria-label="View document"
            >
              <BrandedSvgIcon src="/icons/admin-recruiter/save.svg" className="h-4 w-4" color={BRAND_ICON} />
            </Link>
            <Link
              href={candidateProfileHref(c.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]"
              aria-label="View profile"
            >
              <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
            </Link>
          </div>
        </div>
      )
    case "status":
      return (
        <div className="flex w-full justify-center">
          <span
            className={`inline-flex items-center rounded-xl px-2.5 py-0.5 text-sm font-medium ${candidateStatusBadgeClassName(c.status)}`}
          >
            {c.status}
          </span>
        </div>
      )
    case "reference":
      return <span className="text-sm text-[#374151]">{c.reference}</span>
    case "jobRole":
      return <span className="text-sm text-[#374151]">{c.role}</span>
    case "createdDate":
      return <span className="text-sm text-[#374151]">{formatDate(c.createdAt)}</span>
    case "location":
      return <span className="text-sm text-[#4B5563]">{c.address || "—"}</span>
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
        <Link href={candidateMailHref(c.id)} className={`text-sm text-[#4B5563] ${LINK_CLASS}`}>
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
