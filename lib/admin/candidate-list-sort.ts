import type { CandidateRow } from "@/app/admin_recruiter/candidates/types";
import { resolveCandidateMatchJobTitle } from "@/lib/admin/candidate-match-job-title";

export const CANDIDATE_LIST_SORTABLE_COLUMNS = [
  "name",
  "status",
  "progressStatus",
  "reference",
  "jobRole",
  "matchJob",
  "jobMatch",
  "createdDate",
  "location",
  "city",
  "zipCode",
  "state",
  "address1",
  "phone",
  "email",
  "dateOfBirth",
  "firstName",
  "lastName",
] as const;

export type CandidateListSortColumn = (typeof CANDIDATE_LIST_SORTABLE_COLUMNS)[number];
export type CandidateListSortDirection = "asc" | "desc";

export type CandidateListSortState = {
  column: CandidateListSortColumn | null;
  direction: CandidateListSortDirection;
};

const SORTABLE_COLUMN_SET = new Set<string>(CANDIDATE_LIST_SORTABLE_COLUMNS);

export const EMPTY_CANDIDATE_LIST_SORT: CandidateListSortState = {
  column: null,
  direction: "desc",
};

export function isCandidateListSortableColumn(
  columnId: string
): columnId is CandidateListSortColumn {
  return SORTABLE_COLUMN_SET.has(columnId);
}

export function defaultCandidateListSortDirection(
  column: CandidateListSortColumn
): CandidateListSortDirection {
  return column === "jobMatch" || column === "createdDate" || column === "dateOfBirth"
    ? "desc"
    : "asc";
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

function compareTextValues(a: string, b: string): number {
  return a.trim().localeCompare(b.trim(), undefined, { numeric: true, sensitivity: "base" });
}

function compareMatchScore(a: CandidateRow, b: CandidateRow): number {
  const aScore = a.aiMatchScore == null ? Number.NEGATIVE_INFINITY : Number(a.aiMatchScore);
  const bScore = b.aiMatchScore == null ? Number.NEGATIVE_INFINITY : Number(b.aiMatchScore);
  if (aScore !== bScore) return aScore - bScore;
  return compareName(a, b);
}

function compareDateValues(aIso: string, bIso: string): number {
  return new Date(aIso).getTime() - new Date(bIso).getTime();
}

function compareEmptyLast(
  aEmpty: boolean,
  bEmpty: boolean,
  valueCmp: number,
  directionMultiplier: number
): number {
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return valueCmp * directionMultiplier;
}

function progressStatusText(row: CandidateRow): string {
  return row.progressStatusName?.trim() || row.progressStatusKey?.trim() || "";
}

function compareColumn(
  column: CandidateListSortColumn,
  a: CandidateRow,
  b: CandidateRow,
  directionMultiplier: number
): number {
  switch (column) {
    case "name":
      return compareName(a, b) * directionMultiplier;
    case "status":
      return compareEmptyLast(
        !a.status?.trim(),
        !b.status?.trim(),
        compareTextValues(a.status || "", b.status || ""),
        directionMultiplier
      );
    case "progressStatus": {
      const aText = progressStatusText(a);
      const bText = progressStatusText(b);
      return compareEmptyLast(!aText, !bText, compareTextValues(aText, bText), directionMultiplier);
    }
    case "reference":
      return compareEmptyLast(
        !a.reference?.trim(),
        !b.reference?.trim(),
        compareTextValues(a.reference || "", b.reference || ""),
        directionMultiplier
      );
    case "jobRole":
      return compareEmptyLast(
        !a.role?.trim(),
        !b.role?.trim(),
        compareTextValues(a.role || "", b.role || ""),
        directionMultiplier
      );
    case "matchJob": {
      const aTitle = resolveCandidateMatchJobTitle(a);
      const bTitle = resolveCandidateMatchJobTitle(b);
      return compareEmptyLast(!aTitle, !bTitle, compareTextValues(aTitle, bTitle), directionMultiplier);
    }
    case "jobMatch":
      return compareMatchScore(a, b) * directionMultiplier;
    case "createdDate":
      return compareEmptyLast(
        !a.createdAt,
        !b.createdAt,
        compareDateValues(a.createdAt || "", b.createdAt || ""),
        directionMultiplier
      );
    case "location":
      return compareEmptyLast(
        !a.address?.trim(),
        !b.address?.trim(),
        compareTextValues(a.address || "", b.address || ""),
        directionMultiplier
      );
    case "city":
      return compareEmptyLast(
        !a.city?.trim(),
        !b.city?.trim(),
        compareTextValues(a.city || "", b.city || ""),
        directionMultiplier
      );
    case "zipCode":
      return compareEmptyLast(
        !a.zip?.trim(),
        !b.zip?.trim(),
        compareTextValues(a.zip || "", b.zip || ""),
        directionMultiplier
      );
    case "state":
      return compareEmptyLast(
        !a.state?.trim(),
        !b.state?.trim(),
        compareTextValues(a.state || "", b.state || ""),
        directionMultiplier
      );
    case "address1":
      return compareEmptyLast(
        !a.address1?.trim(),
        !b.address1?.trim(),
        compareTextValues(a.address1 || "", b.address1 || ""),
        directionMultiplier
      );
    case "phone":
      return compareEmptyLast(
        !a.phone?.trim(),
        !b.phone?.trim(),
        compareTextValues(a.phone || "", b.phone || ""),
        directionMultiplier
      );
    case "email":
      return compareEmptyLast(
        !a.email?.trim(),
        !b.email?.trim(),
        compareTextValues(a.email || "", b.email || ""),
        directionMultiplier
      );
    case "dateOfBirth":
      return compareEmptyLast(
        !a.dateOfBirth,
        !b.dateOfBirth,
        compareDateValues(a.dateOfBirth || "", b.dateOfBirth || ""),
        directionMultiplier
      );
    case "firstName":
      return compareEmptyLast(
        !a.firstName?.trim(),
        !b.firstName?.trim(),
        compareTextValues(a.firstName || "", b.firstName || ""),
        directionMultiplier
      );
    case "lastName":
      return compareEmptyLast(
        !a.lastName?.trim(),
        !b.lastName?.trim(),
        compareTextValues(a.lastName || "", b.lastName || ""),
        directionMultiplier
      );
  }
}

export function sortCandidateRows(
  rows: CandidateRow[],
  sort: CandidateListSortState
): CandidateRow[] {
  if (!sort.column) return rows;

  const sorted = [...rows];
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    const cmp = compareColumn(sort.column!, a, b, directionMultiplier);
    if (cmp !== 0) return cmp;
    return compareName(a, b);
  });

  return sorted;
}
