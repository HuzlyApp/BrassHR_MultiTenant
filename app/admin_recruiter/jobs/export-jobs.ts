import {
  exportRowsAsCsv,
  exportRowsAsXls,
  formatExportDate,
  type ExportColumn,
} from "@/lib/admin/export-list-download";
import type { JobColumnId } from "./job-columns";
import {
  applicantCount,
  formatJobListCommissionFeeText,
  formatJobListPayRateText,
  hiredApplicantCount,
  jobContractGroup,
  jobListDisplayTitle,
  jobLocation,
  jobPlacementType,
  jobStatusSortLabel,
  newApplicantCount,
  type JobListRow,
} from "./render-job-list-cell";

function relationName(
  value: JobListRow["professions"] | JobListRow["specialties"] | JobListRow["onboarding_flows"]
): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() || "";
}

function sourceTypeLabel(job: JobListRow): string {
  const raw = String(job.source_type ?? "").trim().toLowerCase();
  return raw === "msp" ? "MSP" : "Internal";
}

const JOB_EXPORT_COLUMN_BUILDERS: Partial<
  Record<JobColumnId, ExportColumn<JobListRow> | ExportColumn<JobListRow>[]>
> = {
  jobTitle: { header: "Job Title", value: (row) => jobListDisplayTitle(row) },
  // jobId: { header: "Job Id", value: (row) => jobDisplayId(row) }, // Job ID hidden for now
  contractGroup: {
    header: "Contract Group",
    value: (row) => jobContractGroup(row),
  },
  candidates: [
    { header: "Applicants (All)", value: (row) => applicantCount(row) },
    { header: "Applicants (New)", value: (row) => newApplicantCount(row) },
    { header: "Applicants (Hired)", value: (row) => hiredApplicantCount(row) },
  ],
  datePosted: {
    header: "Date Posted",
    value: (row) => formatExportDate(row.published_at || row.created_at),
  },
  assignee: { header: "Assignee", value: () => "HR Manager" },
  jobStatus: {
    header: "Job Status",
    value: (row) => jobStatusSortLabel(row.status),
  },
  payRate: {
    header: "Pay Rate",
    value: (row) => formatJobListPayRateText(row),
  },
  commissionFee: {
    header: "Commission Fee",
    value: (row) => formatJobListCommissionFeeText(row),
  },
  location: { header: "Location", value: (row) => jobLocation(row) },
  placementType: {
    header: "Placement type",
    value: (row) => jobPlacementType(row),
  },
  employmentType: {
    header: "W2 / 1099",
    value: (row) => row.employment_type || "",
  },
  jobType: {
    header: "Employment Type",
    value: (row) => row.shift_type?.trim() || "",
  },
  profession: {
    header: "Profession",
    value: (row) => relationName(row.professions),
  },
  specialty: {
    header: "Specialty",
    value: (row) => relationName(row.specialties),
  },
  workflow: {
    header: "Assigned Workflow",
    value: (row) => relationName(row.onboarding_flows),
  },
  createdDate: {
    header: "Created Date",
    value: (row) => formatExportDate(row.created_at),
  },
  applicationDeadline: {
    header: "Application Deadline",
    value: (row) => formatExportDate(row.application_deadline),
  },
};

/** Always included so Internal / MSP context is clear even when not a table column. */
const SOURCE_TYPE_COLUMN: ExportColumn<JobListRow> = {
  header: "Source Type",
  value: (row) => sourceTypeLabel(row),
};

const DEFAULT_EXPORT_COLUMN_IDS: JobColumnId[] = [
  "jobTitle",
  // "jobId", // Job ID hidden for now
  "contractGroup",
  "jobType",
  "employmentType",
  "profession",
  "specialty",
  "location",
  "placementType",
  "jobStatus",
  "payRate",
  "commissionFee",
  "datePosted",
  "candidates",
  "assignee",
  "workflow",
  "createdDate",
  "applicationDeadline",
];

function flattenBuilders(
  ids: JobColumnId[]
): ExportColumn<JobListRow>[] {
  const columns: ExportColumn<JobListRow>[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (id === "actions") continue;
    const builder = JOB_EXPORT_COLUMN_BUILDERS[id];
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

/**
 * Builds export columns from the current Jobs table column order.
 * Falls back to a full default set when order is empty / only actions.
 */
export function buildJobExportColumns(
  columnOrder?: JobColumnId[] | null
): ExportColumn<JobListRow>[] {
  const ordered = (columnOrder ?? [])
    .filter((id): id is JobColumnId => typeof id === "string" && id !== "actions");

  const fromVisible = flattenBuilders(ordered.length ? ordered : DEFAULT_EXPORT_COLUMN_IDS);
  const columns =
    fromVisible.length > 0 ? fromVisible : flattenBuilders(DEFAULT_EXPORT_COLUMN_IDS);

  const hasSource = columns.some((col) => col.header === SOURCE_TYPE_COLUMN.header);
  return hasSource ? columns : [SOURCE_TYPE_COLUMN, ...columns];
}

export function exportJobsCsv(
  rows: JobListRow[],
  options?: { columnOrder?: JobColumnId[] | null; filename?: string }
) {
  const columns = buildJobExportColumns(options?.columnOrder);
  exportRowsAsCsv(rows, columns, options?.filename ?? "jobs.csv");
}

export function exportJobsXls(
  rows: JobListRow[],
  options?: { columnOrder?: JobColumnId[] | null; filename?: string }
) {
  const columns = buildJobExportColumns(options?.columnOrder);
  exportRowsAsXls(rows, columns, options?.filename ?? "jobs.xls");
}
