export type CandidateTabId =
  | "all"
  | "new"
  | "pending"
  | "for_approval"
  | "approved"
  | "disapproved";

export type CandidateTab = {
  id: CandidateTabId;
  label: string;
  href: string;
};

export const CANDIDATES_TABS: CandidateTab[] = [
  { id: "all", label: "All", href: "/admin_recruiter/candidates" },
  { id: "new", label: "New", href: "/admin_recruiter/new" },
  { id: "pending", label: "Pending Review", href: "/admin_recruiter/pending" },
  { id: "for_approval", label: "Pre Approval", href: "/admin_recruiter/pre-approval" },
  { id: "approved", label: "Approved", href: "/admin_recruiter/approved" },
  { id: "disapproved", label: "Rejected", href: "/admin_recruiter/disapproved" },
];

export const CANDIDATE_ROUTE_PREFIXES = [
  "/admin_recruiter/candidates",
  "/admin_recruiter/new",
  "/admin_recruiter/pending",
  "/admin_recruiter/pre-approval",
  "/admin_recruiter/approved",
  "/admin_recruiter/disapproved",
];

export function getActiveCandidateTab(pathname: string): CandidateTabId | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const match = CANDIDATES_TABS.find((tab) => tab.href === normalized);
  return match?.id ?? null;
}

export function isCandidatesListRoute(pathname: string): boolean {
  return getActiveCandidateTab(pathname) !== null;
}
