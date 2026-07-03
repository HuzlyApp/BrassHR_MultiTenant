"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { staffFetchInit } from "@/lib/staff-auth-headers";
import {
  STAFF_CONVERSATIONS_QUERY_KEY,
  type StaffConversationsPayload,
} from "@/lib/messaging/hooks/use-staff-conversations";

export async function markConversationRead(workerId: string): Promise<void> {
  const res = await fetch(`/api/admin/messages/conversations/${encodeURIComponent(workerId)}/read`, {
    method: "POST",
    ...(await staffFetchInit()),
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Could not mark conversation as read");
  }
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useCallback(
    async (workerId: string) => {
      const id = workerId.trim();
      if (!id) return;

      queryClient.setQueryData<StaffConversationsPayload>(
        STAFF_CONVERSATIONS_QUERY_KEY,
        (prev) => {
          if (!prev) return prev;
          const conversations = prev.conversations.map((c) =>
            c.workerId === id ? { ...c, unreadCount: 0 } : c
          );
          const unreadMessages = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
          return { ...prev, conversations, unreadMessages };
        }
      );

      try {
        await markConversationRead(id);
      } finally {
        await queryClient.invalidateQueries({ queryKey: STAFF_CONVERSATIONS_QUERY_KEY });
      }
    },
    [queryClient]
  );
}
