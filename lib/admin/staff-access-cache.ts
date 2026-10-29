import type { QueryClient } from "@tanstack/react-query";
import type { StoredGrant } from "@/lib/auth/permission-catalog";

export type StaffAccessGrant = { key: string } & StoredGrant;

/** Serializable staff module access. Tenant comes from the server session, never from the client. */
export type StaffAccessRecord = {
  tenantId: string;
  godAdmin: boolean;
  grants: StaffAccessGrant[];
  viewKeys: string[];
};

export const STAFF_ACCESS_QUERY_ROOT = "staff-access";

export function staffAccessQueryKey(tenantId: string) {
  return [STAFF_ACCESS_QUERY_ROOT, tenantId] as const;
}

export function staffAccessRevision(access: StaffAccessRecord): string {
  const grants = access.grants
    .map((grant) => `${grant.key}:${grant.canView ? 1 : 0}${grant.canEdit ? 1 : 0}${grant.canDelete ? 1 : 0}`)
    .join(",");
  return `${access.tenantId}:${access.godAdmin ? 1 : 0}:${access.viewKeys.join(",")}:${grants}`;
}

export function isStaffAccessRecord(value: unknown): value is StaffAccessRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StaffAccessRecord>;
  return typeof record.tenantId === "string" && record.tenantId.length > 0 && Array.isArray(record.viewKeys);
}

export function writeStaffAccessCache(queryClient: QueryClient, access: StaffAccessRecord): void {
  queryClient.setQueryData(staffAccessQueryKey(access.tenantId), access);
}

/** Drop every tenant's access cache. Used on view-as and sign-out. */
export function clearStaffAccessCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: [STAFF_ACCESS_QUERY_ROOT] });
}
