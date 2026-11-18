import { isCandidateRole, isWorkerRole, type PortalRole } from "@/lib/auth/app-role";

const WORKER_PAGE_PREFIXES = ["/application/home", "/application/applicant-dashboard"];
const CANDIDATE_PAGE_PREFIXES = ["/application/candidate"];

/** Operational applicant APIs. Shared profile, jobs, and resume APIs stay available to both portals. */
const WORKER_API_PREFIXES = [
  "/api/applicant-portal/attendance",
  "/api/applicant-portal/schedule",
  "/api/applicant-portal/appointments",
  "/api/applicant-portal/account-overview",
  "/api/applicant-portal/notes",
  "/api/applicant-portal/locations",
  "/api/applicant-portal/groups",
  "/api/applicant-portal/credentials",
  "/api/applicant-portal/documents",
  "/api/applicant-portal/agreement",
  "/api/applicant-portal/help",
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function portalHomePath(role: unknown): string {
  return isCandidateRole(role) ? "/application/candidate" : "/application/home";
}

export function isWorkerPortalPath(pathname: string): boolean {
  return WORKER_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isCandidatePortalPath(pathname: string): boolean {
  return CANDIDATE_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isWorkerPortalApi(pathname: string): boolean {
  return WORKER_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

/** Page a signed-in portal user must leave, or null when the current page is allowed. */
export function portalPageRedirect(pathname: string, role: unknown): string | null {
  if (isCandidateRole(role) && isWorkerPortalPath(pathname)) return "/application/candidate";
  if (isWorkerRole(role) && isCandidatePortalPath(pathname)) return "/application/home";
  return null;
}

/** True when this portal role may not call the applicant API path. */
export function portalApiForbidden(pathname: string, role: unknown): boolean {
  return isCandidateRole(role) && isWorkerPortalApi(pathname);
}

export function portalRoleFromResolved(role: unknown): PortalRole {
  return isCandidateRole(role) ? "candidate" : "worker";
}
