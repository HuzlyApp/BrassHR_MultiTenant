const ROLE_KEY = /^[a-z][a-z0-9_]{0,63}$/;

/** Stored role token. Staff names come from public.staff_roles. */
export type AppRole = string;

export type PortalRole = "candidate" | "worker";

export function parseAppRole(v: unknown): AppRole | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (s === "god_admin" || s === "owner") return "admin";
  if (s === "client") return "recruiter";
  return ROLE_KEY.test(s) ? s : null;
}

/** Applicant who has not been hired. Not a staff role. */
export function isCandidateRole(role: unknown): boolean {
  return parseAppRole(role) === "candidate";
}

/** Hired applicant. Not a staff role. */
export function isWorkerRole(role: unknown): boolean {
  return parseAppRole(role) === "worker";
}

/** Candidate and worker share applicant auth and never receive staff grants. */
export function isPortalRole(role: unknown): boolean {
  const parsed = parseAppRole(role);
  return parsed === "candidate" || parsed === "worker";
}

export function isStaffRole(role: AppRole): boolean {
  return !isPortalRole(role);
}

export function roleRank(role: AppRole): number {
  if (role === "admin") return 4;
  if (role === "worker") return 1;
  if (role === "candidate") return 0;
  return 2;
}

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
  return roleRank(role) >= roleRank(min);
}
