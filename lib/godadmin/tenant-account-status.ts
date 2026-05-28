export type TenantAccountStatus = "active" | "inactive" | "deactivated";

export type TenantConsoleRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantAccountStatus;
  created_at: string;
  updated_at: string;
};

export function tenantStatusFromIsActive(isActive: boolean | null | undefined): TenantAccountStatus {
  return isActive === false ? "deactivated" : "active";
}

export function isTenantDeactivated(status: TenantAccountStatus): boolean {
  return status === "deactivated" || status === "inactive";
}

export function formatTenantConsoleTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
