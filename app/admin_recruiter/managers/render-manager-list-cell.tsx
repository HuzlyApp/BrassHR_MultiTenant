import type { ReactNode } from "react"
import Link from "next/link"
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar"
import type { ManagerColumnId } from "./manager-columns"

export type ManagerListRow = {
  id: string
  name: string
  email: string
  role: string
  department: string
  location: string
  status: string
  createdAt: string | null
  profilePhotoUrl: string | null
  phone: string
  reference: string
}

const LINK_CLASS =
  "truncate text-left transition hover:text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"

export function renderManagerListCell(
  col: ManagerColumnId,
  m: ManagerListRow,
  formatDate: (iso: string | null) => string
): ReactNode {
  switch (col) {
    case "name":
      return (
        <div className="flex min-w-0 items-center gap-3">
          <CandidateListAvatar name={m.name || "NA"} photoUrl={m.profilePhotoUrl} />
          <div className="min-w-0">
            <span className={`block text-sm font-medium text-black ${LINK_CLASS}`}>{m.name}</span>
            {m.email ? (
              <span className={`block text-xs text-[#4B5563] ${LINK_CLASS}`}>{m.email}</span>
            ) : (
              <div className="truncate text-xs text-[#4B5563]">—</div>
            )}
          </div>
        </div>
      )
    case "role":
      return <span className="text-sm text-[#374151]">{m.role || "—"}</span>
    case "department":
      return <span className="text-sm text-[#374151]">{m.department || "—"}</span>
    case "location":
      return <span className="text-sm text-[#374151]">{m.location || "—"}</span>
    case "status": {
      const statusLower = (m.status || "").toLowerCase()
      const isInactive =
        statusLower === "inactive" ||
        statusLower === "terminated" ||
        statusLower === "archived"
      return (
        <span
          className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap ${
            isInactive ? "bg-[#94A3B8] text-white" : "bg-[#14B8A6] text-white"
          }`}
        >
          {m.status || "—"}
        </span>
      )
    }
    case "email":
      return <span className="text-sm text-[#4B5563]">{m.email || "—"}</span>
    case "phone":
      return <span className="text-sm text-[#4B5563]">{m.phone || "—"}</span>
    case "reference":
      return <span className="text-sm text-[#374151]">{m.reference || "—"}</span>
    case "createdDate":
      return <span className="text-sm text-[#374151]">{formatDate(m.createdAt)}</span>
    case "profile":
      return (
        <Link
          href="#"
          className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[#D1D5DB] bg-white px-3.5 py-1 text-xs font-medium text-[#374151] shadow-2xs transition hover:bg-gray-50"
        >
          Profile
        </Link>
      )
    default:
      return <span className="text-sm text-[#4B5563]">—</span>
  }
}
