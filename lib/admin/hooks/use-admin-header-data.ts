"use client";

import { useQuery } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";

export type HeaderNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

export type AdminHeaderDataPayload = {
  userId: string;
  notifications: HeaderNotification[];
  unreadNotifications: number;
};

export const ADMIN_HEADER_DATA_QUERY_KEY = ["admin-header-data"] as const;

async function fetchAdminHeaderData(): Promise<AdminHeaderDataPayload> {
  const res = await fetch("/api/admin/header-data", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const payload = (await res.json()) as AdminHeaderDataPayload & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `Header data failed (${res.status})`);
  }
  return {
    userId: payload.userId,
    notifications: payload.notifications ?? [],
    unreadNotifications: payload.unreadNotifications ?? 0,
  };
}

export function useAdminHeaderData() {
  const query = useQuery({
    queryKey: ADMIN_HEADER_DATA_QUERY_KEY,
    queryFn: fetchAdminHeaderData,
    staleTime: 30_000,
  });

  return {
    userId: query.data?.userId ?? null,
    notifications: query.data?.notifications ?? [],
    unreadNotifications: query.data?.unreadNotifications ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
