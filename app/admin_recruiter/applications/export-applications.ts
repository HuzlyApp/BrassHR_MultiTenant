import {
  exportRowsAsCsv,
  exportRowsAsXls,
  formatExportDate,
  type ExportColumn,
} from "@/lib/admin/export-list-download";
import {
  resolveApplicationApplicantEmail,
  resolveApplicationApplicantLocation,
  resolveApplicationApplicantName,
  resolveApplicationApplicantPhone,
  type ApplicationApplicantSource,
  type EmbeddedRecord,
} from "@/lib/jobs/application-applicant-display";
import {
  applicationCurrentStageMeta,
  applicationStatusLabel,
} from "@/lib/jobs/application-status";

export type ApplicationExportRow = ApplicationApplicantSource & {
  id: string;
  status: string;
  statusName?: string | null;
  created_at: string;
  submitted_at?: string | null;
  ai_match_score?: number | null;
  ai_match_display_category?: string | null;
  ai_requirement_counts?: { confirmed: number; verify: number; notMet: number } | null;
  assignedRecruiter?: { name: string } | null;
  job_requisitions?: EmbeddedRecord;
};

function oneEmbedded(value: EmbeddedRecord): Record<string, unknown> {
  if (!value) return {};
  return (Array.isArray(value) ? value[0] : value) ?? {};
}

function matchPercent(row: ApplicationExportRow): string {
  if (row.ai_match_score == null) return "";
  return `${Math.round(row.ai_match_score)}%`;
}

function evaluationLabel(row: ApplicationExportRow): string {
  return String(row.ai_match_display_category ?? "").trim() || matchPercent(row);
}

function buildColumns(includeJob: boolean): ExportColumn<ApplicationExportRow>[] {
  const cols: ExportColumn<ApplicationExportRow>[] = [
    { header: "Candidate", value: (row) => resolveApplicationApplicantName(row) },
    { header: "Email", value: (row) => resolveApplicationApplicantEmail(row) },
    { header: "Phone", value: (row) => resolveApplicationApplicantPhone(row) },
    { header: "Location", value: (row) => resolveApplicationApplicantLocation(row) },
    { header: "Match %", value: (row) => matchPercent(row) },
    {
      header: "Conf.",
      value: (row) =>
        row.ai_requirement_counts == null ? "" : String(row.ai_requirement_counts.confirmed),
    },
    {
      header: "Verify",
      value: (row) =>
        row.ai_requirement_counts == null ? "" : String(row.ai_requirement_counts.verify),
    },
    {
      header: "Not Met",
      value: (row) =>
        row.ai_requirement_counts == null ? "" : String(row.ai_requirement_counts.notMet),
    },
    {
      header: "Current Stage",
      value: (row) => applicationCurrentStageMeta(row.status).label,
    },
    {
      header: "Application Date",
      value: (row) => formatExportDate(row.submitted_at ?? row.created_at),
    },
    { header: "Evaluation", value: (row) => evaluationLabel(row) },
    { header: "Assignee", value: (row) => row.assignedRecruiter?.name ?? "" },
    {
      header: "Progress Status",
      value: (row) => row.statusName?.trim() || applicationStatusLabel(row.status),
    },
  ];

  if (includeJob) {
    cols.splice(1, 0, {
      header: "Job",
      value: (row) => String(oneEmbedded(row.job_requisitions).public_title ?? "").trim(),
    });
  }

  return cols;
}

export function exportApplicationsCsv(
  rows: ApplicationExportRow[],
  options?: { includeJob?: boolean; filename?: string }
) {
  exportRowsAsCsv(
    rows,
    buildColumns(Boolean(options?.includeJob)),
    options?.filename ?? "job-candidates.csv"
  );
}

export function exportApplicationsXls(
  rows: ApplicationExportRow[],
  options?: { includeJob?: boolean; filename?: string }
) {
  exportRowsAsXls(
    rows,
    buildColumns(Boolean(options?.includeJob)),
    options?.filename ?? "job-candidates.xls"
  );
}
