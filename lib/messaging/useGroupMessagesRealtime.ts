"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { GroupMessageRow } from "@/lib/messaging/group-conversations";

function toGroupMessageRow(value: unknown): GroupMessageRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.group_id !== "string" ||
    typeof row.sender_id !== "string" ||
    typeof row.sender_name !== "string" ||
    typeof row.content !== "string" ||
    typeof row.sent_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    group_id: row.group_id,
    tenant_id: String(row.tenant_id ?? ""),
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_role: row.sender_role === "worker" ? "worker" : "recruiter",
    content: row.content,
    sent_at: row.sent_at,
  };
}

export function useGroupMessagesRealtime(
  groupId: string | null | undefined,
  setMessages: Dispatch<SetStateAction<GroupMessageRow[]>>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || !groupId) return;

    const channel = supabaseBrowser
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = toGroupMessageRow(payload.new);
          if (!row) return;
          setMessages((current) => {
            if (current.some((item) => item.id === row.id)) return current;
            return [...current, row].sort(
              (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, groupId, setMessages]);
}
