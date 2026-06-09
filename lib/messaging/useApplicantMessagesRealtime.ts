"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  mergeApplicantMessage,
  toApplicantMessageRow,
  type ApplicantMessage,
} from "@/lib/messaging/applicant-messages";

export function useApplicantMessagesRealtime(
  workerId: string | null | undefined,
  setMessages: Dispatch<SetStateAction<ApplicantMessage[]>>,
  enabled = true
) {
  useEffect(() => {
    if (!enabled || !workerId) return;

    const channel = supabaseBrowser
      .channel(`applicant-messages-${workerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "applicant_messages",
          filter: `worker_id=eq.${workerId}`,
        },
        (payload) => {
          const row = toApplicantMessageRow(payload.new);
          if (!row) return;
          setMessages((current) => mergeApplicantMessage(current, row));
        }
      )
      .subscribe();

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, workerId, setMessages]);
}
