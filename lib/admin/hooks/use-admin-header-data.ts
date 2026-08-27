"use client";

import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";

export type HeaderNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  link: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

export type AdminHeaderDataPayload = {
  userId: string;
  displayName?: string;
  role?: string | null;
  roleLabel?: string;
  tenantId?: string | null;
  tenantName?: string | null;
  avatarUrl?: string | null;
  notifications: HeaderNotification[];
  unreadNotifications: number;
  correlationId?: string;
};

export const ADMIN_HEADER_DATA_QUERY_KEY = ["admin-header-data"] as const;

async function fetchAdminHeaderData(): Promise<AdminHeaderDataPayload> {
  const res = await fetch("/api/admin/header-data", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const payload = (await res.json()) as AdminHeaderDataPayload & { error?: string };
  if (!res.ok) {
    const suffix = payload.correlationId ? ` (${payload.correlationId})` : "";
    throw new Error((payload.error || `Header data failed (${res.status})`) + suffix);
  }
  return {
    userId: payload.userId,
    displayName: payload.displayName,
    role: payload.role ?? null,
    roleLabel: payload.roleLabel,
    tenantId: payload.tenantId ?? null,
    tenantName: payload.tenantName ?? null,
    avatarUrl: payload.avatarUrl ?? null,
    notifications: (payload.notifications ?? []).map((item) => ({
      ...item,
      link: item.link ?? null,
    })),
    unreadNotifications: Math.max(0, payload.unreadNotifications ?? 0),
    correlationId: payload.correlationId,
  };
}

export function useAdminHeaderData() {
  const query = useQuery({
    queryKey: ADMIN_HEADER_DATA_QUERY_KEY,
    queryFn: fetchAdminHeaderData,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  return {
    userId: query.data?.userId ?? null,
    displayName: query.data?.displayName ?? null,
    role: query.data?.role ?? null,
    roleLabel: query.data?.roleLabel ?? null,
    tenantId: query.data?.tenantId ?? null,
    tenantName: query.data?.tenantName ?? null,
    avatarUrl: query.data?.avatarUrl ?? null,
    notifications: query.data?.notifications ?? [],
    unreadNotifications: query.data?.unreadNotifications ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
