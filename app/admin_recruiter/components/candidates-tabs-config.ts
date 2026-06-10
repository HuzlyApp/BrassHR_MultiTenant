export type CandidateTabId =
  | "all"
  | "new"
  | "pending"
  | "approved"
  | "disapproved"
  | "attendance";

export type CandidateTab = {
  id: CandidateTabId;
  label: string;
  href: string;
};

export const CANDIDATES_TABS: CandidateTab[] = [
  { id: "all", label: "All", href: "/admin_recruiter/candidates" },
  { id: "new", label: "New", href: "/admin_recruiter/new" },
  { id: "pending", label: "Pending", href: "/admin_recruiter/pending" },
  { id: "approved", label: "Approved", href: "/admin_recruiter/approved" },
  { id: "disapproved", label: "Disapproved", href: "/admin_recruiter/disapproved" },
  { id: "attendance", label: "Attendance", href: "/admin_recruiter/attendance" },
];

export const CANDIDATE_ROUTE_PREFIXES = [
  "/admin_recruiter/candidates",
  "/admin_recruiter/new",
  "/admin_recruiter/pending",
  "/admin_recruiter/approved",
  "/admin_recruiter/disapproved",
  "/admin_recruiter/attendance",
];

export function getActiveCandidateTab(pathname: string): CandidateTabId | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const match = CANDIDATES_TABS.find((tab) => tab.href === normalized);
  return match?.id ?? null;
}

export function isCandidatesListRoute(pathname: string): boolean {
  return getActiveCandidateTab(pathname) !== null;
}
