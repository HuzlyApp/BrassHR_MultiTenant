"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import type { StaffConversation } from "@/lib/messaging/staff-conversations";

export type StaffConversationsPayload = {
  conversations: StaffConversation[];
  tenantId: string | null;
  unreadMessages: number;
};

export const STAFF_CONVERSATIONS_QUERY_KEY = ["admin-staff-conversations"] as const;

async function fetchStaffConversations(): Promise<StaffConversationsPayload> {
  const res = await fetch("/api/admin/messages/conversations", {
    ...(await staffFetchInit()),
    cache: "no-store",
  });
  const payload = (await res.json()) as StaffConversationsPayload & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Could not load conversations.");
  }
  return {
    conversations: payload.conversations ?? [],
    tenantId: payload.tenantId ?? null,
    unreadMessages: payload.unreadMessages ?? 0,
  };
}

export function useStaffConversations(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STAFF_CONVERSATIONS_QUERY_KEY,
    queryFn: fetchStaffConversations,
    staleTime: 15_000,
    enabled,
  });

  return {
    conversations: query.data?.conversations ?? [],
    tenantId: query.data?.tenantId ?? null,
    unreadMessages: query.data?.unreadMessages ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: STAFF_CONVERSATIONS_QUERY_KEY }),
  };
}
