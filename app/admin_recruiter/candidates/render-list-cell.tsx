import type { ReactNode } from "react"
import type { CandidateColumnId } from "./column-config"
import type { CandidateRow } from "./types"

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "NA"
  const first = parts[0]?.[0] ?? ""
  const last = parts[parts.length - 1]?.[0] ?? ""
  return (first + last).toUpperCase()
}

export function renderListCell(
  col: CandidateColumnId,
  c: CandidateRow,
  formatDate: (iso: string | null) => string
): ReactNode {
  switch (col) {
    case "name":
      return (
        <div className="flex items-center gap-3 min-w-0 w-full">
          <div className="h-8 w-8 shrink-0 rounded-full bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] text-white text-sm font-semibold flex items-center justify-center">
            {initialsFromName(c.name || "NA")}
          </div>
          <div className="text-sm font-medium text-black truncate">{c.name || "—"}</div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <img src="/icons/admin-recruiter/save.svg" alt="Save" className="h-4 w-4" />
            <img src="/icons/admin-recruiter/eye.svg" alt="View" className="h-4 w-4" />
          </div>
        </div>
      )
    case "status":
      const status = c.status.trim().toLowerCase()
      return (
        <div className="flex w-full justify-center">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-sm font-medium ${
              status === "pending"
                ? "border border-[#F59E0B] bg-[#F59E0B] text-white"
                : status === "approved"
                  ? "border border-[#22C55E] bg-[#22C55E] text-white"
                  : status === "disapproved"
                    ? "border border-[#FB7185] bg-[#FB7185] text-white"
                : "border border-[#E5E7EB] text-black"
            }`}
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
      return <span className="text-sm text-[#4B5563]">{c.email || "—"}</span>
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
