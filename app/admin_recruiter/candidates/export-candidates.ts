import {
  exportRowsAsCsv,
  exportRowsAsXls,
  formatExportDate,
  type ExportColumn,
} from "@/lib/admin/export-list-download";
import type { CandidateRow } from "./types";

const CANDIDATE_EXPORT_COLUMNS: ExportColumn<CandidateRow>[] = [
  { header: "Name", value: (row) => row.name },
  { header: "Reference", value: (row) => row.reference },
  { header: "Role", value: (row) => row.role },
  { header: "Email", value: (row) => row.email },
  { header: "Phone", value: (row) => row.phone },
  { header: "Address", value: (row) => row.address },
  { header: "Status", value: (row) => row.status },
  { header: "Applied", value: (row) => formatExportDate(row.createdAt) },
];

export function exportCandidatesCsv(rows: CandidateRow[], filename = "candidates.csv") {
  exportRowsAsCsv(rows, CANDIDATE_EXPORT_COLUMNS, filename);
}

export function exportCandidatesXls(rows: CandidateRow[], filename = "candidates.xls") {
  exportRowsAsXls(rows, CANDIDATE_EXPORT_COLUMNS, filename);
}
