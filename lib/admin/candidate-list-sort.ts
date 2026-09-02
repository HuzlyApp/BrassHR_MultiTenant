import type { CandidateRow } from "@/app/admin_recruiter/candidates/types";

export type CandidateListSortColumn = "name" | "jobMatch" | "createdDate";
export type CandidateListSortDirection = "asc" | "desc";

export type CandidateListSortState = {
  column: CandidateListSortColumn | null;
  direction: CandidateListSortDirection;
};

export const EMPTY_CANDIDATE_LIST_SORT: CandidateListSortState = {
  column: null,
  direction: "desc",
};

export function isCandidateListSortableColumn(
  columnId: string
): columnId is CandidateListSortColumn {
  return columnId === "name" || columnId === "jobMatch" || columnId === "createdDate";
}

export function defaultCandidateListSortDirection(
  column: CandidateListSortColumn
): CandidateListSortDirection {
  return column === "name" ? "asc" : "desc";
}

export function toggleCandidateListSort(
  current: CandidateListSortState,
  column: CandidateListSortColumn
): CandidateListSortState {
  if (current.column !== column) {
    return { column, direction: defaultCandidateListSortDirection(column) };
  }
  return {
    column,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

function compareName(a: CandidateRow, b: CandidateRow): number {
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function compareMatchScore(a: CandidateRow, b: CandidateRow): number {
  const aScore = a.aiMatchScore == null ? Number.NEGATIVE_INFINITY : Number(a.aiMatchScore);
  const bScore = b.aiMatchScore == null ? Number.NEGATIVE_INFINITY : Number(b.aiMatchScore);
  if (aScore !== bScore) return aScore - bScore;
  return compareName(a, b);
}

function compareAppliedDate(a: CandidateRow, b: CandidateRow): number {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.NEGATIVE_INFINITY;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.NEGATIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return compareName(a, b);
}

export function sortCandidateRows(
  rows: CandidateRow[],
  sort: CandidateListSortState
): CandidateRow[] {
  if (!sort.column) return rows;

  const sorted = [...rows];
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    let cmp = 0;
    if (sort.column === "name") cmp = compareName(a, b);
    else if (sort.column === "jobMatch") cmp = compareMatchScore(a, b);
    else if (sort.column === "createdDate") cmp = compareAppliedDate(a, b);
    return cmp * directionMultiplier;
  });

  return sorted;
}
