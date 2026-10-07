import { isSharedClosedGroupKey } from "./groups";

type StageScopedStatus = {
  id: string;
  groupId?: string | null;
  groupSystemKey?: string | null;
};

/**
 * Statuses a recruiter can pick on one stage: groups assigned to that stage,
 * plus the shared Closed group. The candidate's current status stays visible
 * even when it belongs to another stage.
 */
export function filterStatusesForAssignedGroups<T extends StageScopedStatus>(
  statuses: T[],
  assignedGroupIds: readonly string[],
  currentStatusId?: string | null
): T[] {
  const allowed = new Set(assignedGroupIds);
  return statuses.filter((status) => {
    if (currentStatusId && status.id === currentStatusId) return true;
    if (isSharedClosedGroupKey(status.groupSystemKey)) return true;
    return Boolean(status.groupId && allowed.has(status.groupId));
  });
}
