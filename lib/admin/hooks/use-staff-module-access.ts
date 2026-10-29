"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import type { StoredGrant } from "@/lib/auth/permission-catalog";

export type StaffModuleGrant = { key: string } & StoredGrant;

export type StaffModuleAccessPayload = {
  godAdmin: boolean;
  grants: StaffModuleGrant[];
  viewKeys: string[];
};

export const STAFF_MODULE_ACCESS_QUERY_KEY = ["admin-staff-module-access"] as const;

const EMPTY_GRANT: StoredGrant = { canView: false, canEdit: false, canDelete: false };
const FULL_GRANT: StoredGrant = { canView: true, canEdit: true, canDelete: true };

async function fetchStaffModuleAccess(): Promise<StaffModuleAccessPayload> {
  const res = await fetch("/api/admin/access", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const payload = (await res.json()) as StaffModuleAccessPayload & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `Access request failed (${res.status})`);
  }
  return {
    godAdmin: payload.godAdmin === true,
    grants: Array.isArray(payload.grants) ? payload.grants : [],
    viewKeys: Array.isArray(payload.viewKeys) ? payload.viewKeys : [],
  };
}

/** Resolve one resource grant. God admins always receive full access. */
export function staffModuleGrantFor(
  grant: StaffModuleGrant | undefined,
  godAdmin: boolean
): StoredGrant {
  if (godAdmin) return FULL_GRANT;
  if (!grant) return EMPTY_GRANT;
  return {
    canView: grant.canView === true,
    canEdit: grant.canEdit === true,
    canDelete: grant.canDelete === true,
  };
}

/** Live module grants from `/api/admin/access` (Redis-backed session path on the server). */
export function useStaffModuleAccess() {
  const query = useQuery({
    queryKey: STAFF_MODULE_ACCESS_QUERY_KEY,
    queryFn: fetchStaffModuleAccess,
    staleTime: 60_000,
  });

  const godAdmin = query.data?.godAdmin === true;
  const grantsByKey = useMemo(() => {
    const map = new Map<string, StaffModuleGrant>();
    for (const grant of query.data?.grants ?? []) {
      if (grant?.key) map.set(grant.key, grant);
    }
    return map;
  }, [query.data?.grants]);

  const grantFor = (resourceKey: string): StoredGrant =>
    staffModuleGrantFor(grantsByKey.get(resourceKey), godAdmin);

  return {
    godAdmin,
    grants: query.data?.grants ?? [],
    viewKeys: query.data?.viewKeys ?? [],
    loading: query.isLoading,
    error: query.error,
    grantFor,
    canView: (resourceKey: string) => grantFor(resourceKey).canView,
    canEdit: (resourceKey: string) => grantFor(resourceKey).canEdit,
    canDelete: (resourceKey: string) => grantFor(resourceKey).canDelete,
    refetch: query.refetch,
  };
}
