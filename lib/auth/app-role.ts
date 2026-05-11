export const APP_ROLES = ["worker", "recruiter", "support", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

const RANK: Record<AppRole, number> = {
  worker: 1,
  recruiter: 2,
  support: 3,
  admin: 4,
};

export function parseAppRole(v: unknown): AppRole | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "god_admin") return "admin";
  if (s === "worker" || s === "recruiter" || s === "support" || s === "admin") return s;
  return null;
}

export function isStaffRole(role: AppRole): boolean {
  return role === "recruiter" || role === "support" || role === "admin";
}

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
  return RANK[role] >= RANK[min];
}
