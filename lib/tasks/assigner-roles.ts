import { matchStaffRole, SEEDED_STAFF_ROLES } from "@/lib/admin/staff-roles";

/** Roles allowed to assign worker tasks when the restriction is enabled. */
export const TASK_ASSIGNER_ROLE_KEYS = new Set(["manager", "hr", "admin"]);

export const DEFAULT_ASSIGN_ONLY_MANAGER_HR = true;

export function canAssignWorkerTasks(
  role: string | null | undefined,
  assignOnlyManagerHr = DEFAULT_ASSIGN_ONLY_MANAGER_HR
): boolean {
  if (!assignOnlyManagerHr) return true;
  const matched = matchStaffRole(role, SEEDED_STAFF_ROLES);
  const key = (matched?.key ?? role ?? "").trim().toLowerCase();
  return TASK_ASSIGNER_ROLE_KEYS.has(key);
}
