import { isArchivedApplicationStatus, normalizeApplicationStatus } from "@/lib/jobs/application-status";

export type ApplicationStatusTabOption = {
  id: string;
  systemKey: string | null;
};

export type ApplicationStatusTabRow = {
  status: string;
  status_id?: string | null;
  application_statuses?:
    | { id?: string; system_key?: string | null }
    | { id?: string; system_key?: string | null }[]
    | null;
};

function oneStatusJoin(
  value: ApplicationStatusTabRow["application_statuses"]
): { id?: string; system_key?: string | null } | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function applicationRowStatusId(row: ApplicationStatusTabRow): string | null {
  const joined = oneStatusJoin(row.application_statuses);
  return row.status_id?.trim() || joined?.id?.trim() || null;
}

export function isApplicationRowArchived(
  row: ApplicationStatusTabRow,
  options: ApplicationStatusTabOption[]
): boolean {
  const joined = oneStatusJoin(row.application_statuses);
  if (joined?.system_key === "archived") return true;
  const option = options.find((item) => item.id === applicationRowStatusId(row));
  if (option?.systemKey === "archived") return true;
  return isArchivedApplicationStatus(row.status);
}

/**
 * Dashboard KPI counts are keyed by application_statuses.id.
 * Rows with a status_id must match that id only — the legacy `status` column
 * (often still "new") must not leak custom statuses into system-key tabs.
 */
export function matchesApplicationStatusTab(
  row: ApplicationStatusTabRow,
  tab: string,
  options: ApplicationStatusTabOption[]
): boolean {
  const archived = isApplicationRowArchived(row, options);
  if (tab === "all") return !archived;

  const option =
    options.find((item) => item.id === tab) ??
    options.find((item) => item.systemKey === tab) ??
    null;
  const targetId = option?.id ?? tab;

  if (option?.systemKey === "archived" || tab === "archived") return archived;
  if (archived) return false;

  const statusId = applicationRowStatusId(row);
  if (statusId) return statusId === targetId;

  if (option?.systemKey) {
    return normalizeApplicationStatus(row.status) === option.systemKey;
  }
  return normalizeApplicationStatus(row.status) === tab;
}
