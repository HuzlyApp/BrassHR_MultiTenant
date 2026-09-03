import {
  exportRowsAsCsv,
  exportRowsAsXls,
  formatExportDate,
  type ExportColumn,
} from "@/lib/admin/export-list-download";
import { resolveCandidateMatchJobTitle } from "@/lib/admin/candidate-match-job-title";
import { formatMatchScore } from "@/lib/jobs/match-analysis/display";
import {
  columnLabel,
  DEFAULT_CANDIDATE_COLUMNS,
  type CandidateColumnId,
} from "./column-config";
import type { CandidateRow } from "./types";

const CANDIDATE_EXPORT_COLUMN_BUILDERS: Partial<
  Record<CandidateColumnId, ExportColumn<CandidateRow> | ExportColumn<CandidateRow>[]>
> = {
  name: { header: columnLabel("name"), value: (row) => row.name },
  status: { header: columnLabel("status"), value: (row) => row.status },
  progressStatus: {
    header: columnLabel("progressStatus"),
    value: (row) =>
      row.progressStatusName?.trim() ||
      row.progressStatusKey?.trim() ||
      "—",
  },
  reference: { header: columnLabel("reference"), value: (row) => row.reference },
  jobRole: { header: columnLabel("jobRole"), value: (row) => row.role },
  matchJob: {
    header: columnLabel("matchJob"),
    value: (row) => resolveCandidateMatchJobTitle(row) || "—",
  },
  jobMatch: {
    header: columnLabel("jobMatch"),
    value: (row) => formatMatchScore(row.aiMatchScore),
  },
  createdDate: {
    header: columnLabel("createdDate"),
    value: (row) => formatExportDate(row.createdAt),
  },
  location: { header: columnLabel("location"), value: (row) => row.address || "—" },
  city: { header: columnLabel("city"), value: (row) => row.city || "—" },
  zipCode: { header: columnLabel("zipCode"), value: (row) => row.zip || "—" },
  state: { header: columnLabel("state"), value: (row) => row.state || "—" },
  address1: { header: columnLabel("address1"), value: (row) => row.address1 || "—" },
  phone: { header: columnLabel("phone"), value: (row) => row.phone || "—" },
  email: { header: columnLabel("email"), value: (row) => row.email || "—" },
  dateOfBirth: {
    header: columnLabel("dateOfBirth"),
    value: (row) => (row.dateOfBirth ? formatExportDate(row.dateOfBirth) : "—"),
  },
  firstName: { header: columnLabel("firstName"), value: (row) => row.firstName || "—" },
  lastName: { header: columnLabel("lastName"), value: (row) => row.lastName || "—" },
};

function flattenBuilders(ids: CandidateColumnId[]): ExportColumn<CandidateRow>[] {
  const columns: ExportColumn<CandidateRow>[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const builder = CANDIDATE_EXPORT_COLUMN_BUILDERS[id];
    if (!builder) continue;
    const list = Array.isArray(builder) ? builder : [builder];
    for (const col of list) {
      if (seen.has(col.header)) continue;
      seen.add(col.header);
      columns.push(col);
    }
  }

  return columns;
}

/** Builds export columns from the current Candidates table column order. */
export function buildCandidateExportColumns(
  columnOrder?: CandidateColumnId[] | null
): ExportColumn<CandidateRow>[] {
  const ordered = (columnOrder ?? []).filter((id): id is CandidateColumnId => typeof id === "string");
  const fromVisible = flattenBuilders(ordered.length ? ordered : DEFAULT_CANDIDATE_COLUMNS);
  return fromVisible.length > 0 ? fromVisible : flattenBuilders(DEFAULT_CANDIDATE_COLUMNS);
}

export function exportCandidatesCsv(
  rows: CandidateRow[],
  options?: { columnOrder?: CandidateColumnId[] | null; filename?: string }
) {
  const columns = buildCandidateExportColumns(options?.columnOrder);
  exportRowsAsCsv(rows, columns, options?.filename ?? "candidates.csv");
}

export function exportCandidatesXls(
  rows: CandidateRow[],
  options?: { columnOrder?: CandidateColumnId[] | null; filename?: string }
) {
  const columns = buildCandidateExportColumns(options?.columnOrder);
  exportRowsAsXls(rows, columns, options?.filename ?? "candidates.xls");
}
