"use client";

import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  clearStaffAccessCache,
  isStaffAccessRecord,
  staffAccessQueryKey,
  staffAccessRevision,
  writeStaffAccessCache,
  type StaffAccessGrant,
  type StaffAccessRecord,
} from "@/lib/admin/staff-access-cache";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import {
  classifyProtectedPath,
  type PermissionAction,
  type StoredGrant,
} from "@/lib/auth/permission-catalog";

export type StaffModuleGrant = StaffAccessGrant;
export type StaffModuleAccessPayload = StaffAccessRecord;

const StaffAccessSeedContext = createContext<StaffAccessRecord | null>(null);

const EMPTY_GRANT: StoredGrant = { canView: false, canEdit: false, canDelete: false };
const FULL_GRANT: StoredGrant = { canView: true, canEdit: true, canDelete: true };

async function fetchStaffModuleAccess(): Promise<StaffAccessRecord> {
  const res = await fetch("/api/admin/access", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const payload = (await res.json()) as StaffAccessRecord & { error?: string };
  if (!res.ok || !isStaffAccessRecord(payload)) {
    throw new Error(payload.error || `Access request failed (${res.status})`);
  }
  return {
    tenantId: payload.tenantId,
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

/** Drop cached grants after an admin updates Roles & Permissions. */
export function invalidateStaffModuleAccess(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["staff-access"] });
}

export { clearStaffAccessCache, writeStaffAccessCache };

/**
 * Puts the server-rendered access record into React Query so the sidebar can paint
 * without waiting on `/api/admin/access`. A missing seed keeps the client fetch.
 */
export function StaffAccessSeed({
  initialAccess,
  children,
}: {
  initialAccess: StaffAccessRecord | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const tenantId = initialAccess?.tenantId ?? "unknown";

  useLayoutEffect(() => {
    if (!initialAccess) return;
    const key = staffAccessQueryKey(initialAccess.tenantId);
    const cached = queryClient.getQueryData<StaffAccessRecord>(key);
    if (!cached || staffAccessRevision(cached) !== staffAccessRevision(initialAccess)) {
      queryClient.setQueryData(key, initialAccess);
    }
  }, [initialAccess, queryClient]);

  useQuery({
    queryKey: staffAccessQueryKey(tenantId),
    queryFn: fetchStaffModuleAccess,
    initialData: initialAccess ?? undefined,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  return <StaffAccessSeedContext.Provider value={initialAccess}>{children}</StaffAccessSeedContext.Provider>;
}

/** Live module grants from `/api/admin/access` (source of truth for UI gates). */
export function useStaffModuleAccess() {
  const seeded = useContext(StaffAccessSeedContext);
  const tenantId = seeded?.tenantId ?? "unknown";
  const query = useQuery({
    queryKey: staffAccessQueryKey(tenantId),
    queryFn: fetchStaffModuleAccess,
    initialData: seeded ?? undefined,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  const godAdmin = query.data?.godAdmin === true;
  const grantsByKey = useMemo(() => {
    const map = new Map<string, StaffModuleGrant>();
    for (const grant of query.data?.grants ?? []) {
      if (grant?.key) map.set(grant.key, grant);
    }
    return map;
  }, [query.data?.grants]);

  const viewKeySet = useMemo(() => {
    if (godAdmin) return new Set(["*"]);
    return new Set(query.data?.viewKeys ?? ["dashboard"]);
  }, [godAdmin, query.data?.viewKeys]);

  const grantFor = (resourceKey: string): StoredGrant =>
    staffModuleGrantFor(grantsByKey.get(resourceKey), godAdmin);

  return {
    godAdmin,
    grants: query.data?.grants ?? [],
    viewKeys: query.data?.viewKeys ?? [],
    viewKeySet,
    loading: query.isLoading && query.data == null,
    error: query.error,
    grantFor,
    canView: (resourceKey: string) => grantFor(resourceKey).canView,
    canEdit: (resourceKey: string) => grantFor(resourceKey).canEdit,
    canDelete: (resourceKey: string) => grantFor(resourceKey).canDelete,
    allows: (resourceKey: string, action: PermissionAction) => {
      const grant = grantFor(resourceKey);
      if (action === "view") return grant.canView;
      if (action === "edit") return grant.canEdit;
      return grant.canDelete;
    },
    refetch: query.refetch,
  };
}

/**
 * Grant for one catalog resource key from the live access API.
 * Pass the same keys seeded in `permission_resources` / Roles UI (e.g. `hiring`, `jobs`).
 */
export function useModulePermission(resourceKey: string) {
  const access = useStaffModuleAccess();
  const grant = access.grantFor(resourceKey);
  return {
    ...access,
    resourceKey,
    ...grant,
  };
}

/**
 * Resolve the module key from the current page path via `permission_resources` prefixes,
 * then return that resource's live grant. Prefer this in shared chrome used across modules.
 */
export function usePathModulePermission(fallbackResourceKey?: string) {
  const pathname = usePathname() ?? "";
  const access = useStaffModuleAccess();
  const classified = classifyProtectedPath(pathname);
  const resourceKey =
    classified.kind === "resource"
      ? classified.resourceKey
      : fallbackResourceKey ?? "";
  const grant = resourceKey
    ? access.grantFor(resourceKey)
    : classified.kind === "shell" || classified.kind === "god_only"
      ? FULL_GRANT
      : EMPTY_GRANT;

  return {
    ...access,
    resourceKey: resourceKey || null,
    ...grant,
  };
}

/** Convenience for components that only need invalidate after role edits. */
export function useInvalidateStaffModuleAccess() {
  const queryClient = useQueryClient();
  return () => invalidateStaffModuleAccess(queryClient);
}
