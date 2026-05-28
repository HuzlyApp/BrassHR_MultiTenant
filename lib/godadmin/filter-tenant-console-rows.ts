import type { TenantAccountStatus, TenantConsoleRow } from "@/lib/godadmin/tenant-account-status";

export type TenantStatusFilter = "all" | "active" | "deactivated";

export function filterTenantConsoleRows(
  rows: TenantConsoleRow[],
  options: { search?: string; status?: TenantStatusFilter }
): TenantConsoleRow[] {
  const search = options.search?.trim().toLowerCase() ?? "";
  const status = options.status ?? "all";

  return rows.filter((row) => {
    if (status === "active" && row.status !== "active") return false;
    if (status === "deactivated" && row.status === "active") return false;

    if (!search) return true;
    const hay = `${row.name} ${row.slug}`.toLowerCase();
    return hay.includes(search);
  });
}

export function tenantStatusLabel(status: TenantAccountStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Inactive";
    case "deactivated":
      return "Deactivated";
    default:
      return status;
  }
}
