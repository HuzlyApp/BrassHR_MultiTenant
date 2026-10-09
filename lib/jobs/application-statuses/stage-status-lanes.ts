import { isSharedClosedGroupKey, isSharedFollowUpStatusName, normalizeStatusCatalogName } from "./groups";

export const STAGE_STATUS_LANES = ["happy_path", "alternate", "closed"] as const;

export type StageStatusLane = (typeof STAGE_STATUS_LANES)[number];

export type StageLaneStatus = {
  id: string;
  name: string;
  sortOrder?: number | null;
  groupId?: string | null;
  groupSortOrder?: number | null;
  groupSystemKey?: string | null;
  /** Recommended, exception, or closed category saved on the status group. Null uses the name default. */
  buttonLane?: string | null;
};

export type SavedStageStatusLane = {
  statusId: string;
  lane: StageStatusLane | "exception" | "follow_up";
  sortOrder: number;
};

const EMPTY_LANES = <T,>(): Record<StageStatusLane, T[]> => ({
  happy_path: [],
  alternate: [],
  closed: [],
});

/** Follow-up Needed is the default follow-up button on every stage. */
export function isDefaultFollowUpStatusName(name: string | null | undefined): boolean {
  const normalized = normalizeStatusCatalogName(name ?? "");
  return normalized === "follow-up needed" || normalized === "follow up needed";
}

function isFollowUpStatusName(name: string): boolean {
  const normalized = normalizeStatusCatalogName(name);
  return (
    isDefaultFollowUpStatusName(name) ||
    normalized.includes("follow-up") ||
    normalized.includes("follow up") ||
    normalized === "unreachable" ||
    normalized === "callback - not available"
  );
}

/** Accepts the current names and the earlier exception / follow_up values. */
export function normalizeStageStatusLane(value: string | null | undefined): StageStatusLane | null {
  if (value === "happy_path" || value === "alternate" || value === "closed") return value;
  if (value === "follow_up") return "alternate";
  if (value === "exception") return "closed";
  return null;
}

export function isStageStatusLane(value: string): value is StageStatusLane {
  return normalizeStageStatusLane(value) != null && (STAGE_STATUS_LANES as readonly string[]).includes(value);
}

/** Category for a status: the group setting, otherwise the name default. */
export function defaultStageStatusLane(status: StageLaneStatus): StageStatusLane {
  const explicit = normalizeStageStatusLane(status.buttonLane);
  if (explicit) return explicit;
  if (isSharedClosedGroupKey(status.groupSystemKey)) return "closed";
  const normalized = normalizeStatusCatalogName(status.name);
  if (
    normalized.includes("reject") ||
    normalized.includes("withdraw") ||
    normalized === "not a fit" ||
    normalized === "talent pool" ||
    normalized === "archived" ||
    normalized === "position closed"
  ) {
    return "closed";
  }
  if (isFollowUpStatusName(status.name)) return "alternate";
  return "happy_path";
}

function compareCatalog<T extends StageLaneStatus>(a: T, b: T): number {
  const groupDelta = (a.groupSortOrder ?? 0) - (b.groupSortOrder ?? 0);
  if (groupDelta !== 0) return groupDelta;
  const sortDelta = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (sortDelta !== 0) return sortDelta;
  return a.name.localeCompare(b.name);
}

function statusBelongsOnStage(status: StageLaneStatus, assignedGroupIds: ReadonlySet<string>): boolean {
  if (isSharedClosedGroupKey(status.groupSystemKey)) return true;
  if (isSharedFollowUpStatusName(status.name)) return true;
  return Boolean(status.groupId && assignedGroupIds.has(status.groupId));
}

/** Split one status group's statuses into the three button categories. */
export function resolveGroupStatusLanes<T extends StageLaneStatus>(
  statuses: readonly T[]
): Record<StageStatusLane, T[]> {
  return orderDefaults([...statuses]);
}

function orderDefaults<T extends StageLaneStatus>(statuses: T[]): Record<StageStatusLane, T[]> {
  const lanes = EMPTY_LANES<T>();
  for (const status of statuses) lanes[defaultStageStatusLane(status)].push(status);
  lanes.happy_path.sort(compareCatalog);
  lanes.alternate.sort(compareCatalog);
  lanes.closed.sort(compareCatalog);
  return lanes;
}

/**
 * Statuses for one Pre-Hire stage or AI analysis step, split into the three
 * button categories: recommended, alternate (exception order), and closed / withdrawn.
 * Saved rows win. Statuses added later append in the default category.
 */
export function resolveStageStatusLanes<T extends StageLaneStatus>(
  statuses: readonly T[],
  assignedGroupIds: readonly string[],
  saved: readonly SavedStageStatusLane[] = []
): Record<StageStatusLane, T[]> {
  const allowed = new Set(assignedGroupIds);
  const eligible = statuses.filter((status) => statusBelongsOnStage(status, allowed));
  const byId = new Map(eligible.map((status) => [status.id, status]));

  if (saved.length === 0) return orderDefaults(eligible);

  const lanes = EMPTY_LANES<T>();
  const placed = new Set<string>();
  const orderedSaved = [...saved].sort((a, b) => a.sortOrder - b.sortOrder || a.statusId.localeCompare(b.statusId));
  for (const row of orderedSaved) {
    const lane = normalizeStageStatusLane(row.lane);
    if (!lane) continue;
    const status = byId.get(row.statusId);
    if (!status || placed.has(status.id)) continue;
    lanes[lane].push(status);
    placed.add(status.id);
  }

  const defaults = orderDefaults(eligible.filter((status) => !placed.has(status.id)));
  for (const lane of STAGE_STATUS_LANES) lanes[lane].push(...defaults[lane]);
  return lanes;
}

/** Next recommended status, then the other statuses in that order. */
export function sequenceOrderedStatuses<T extends { id: string }>(
  ordered: readonly T[],
  currentStatusId?: string | null
): { next: T | null; actions: T[] } {
  const currentIndex = currentStatusId
    ? ordered.findIndex((status) => status.id === currentStatusId)
    : -1;
  const next = currentIndex >= 0 ? (ordered[currentIndex + 1] ?? null) : (ordered[0] ?? null);
  const rest = ordered.filter((status) => status.id !== currentStatusId && status.id !== next?.id);
  return { next, actions: next ? [next, ...rest] : rest };
}
