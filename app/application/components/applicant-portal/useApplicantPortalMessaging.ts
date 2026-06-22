"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApplicantMessage } from "@/app/application/components/applicant-portal/types";
import {
  mergeApplicantMessage,
  sortApplicantMessages,
} from "@/lib/messaging/applicant-messages";
import {
  filterApplicantMessagesForActiveSession,
  markApplicantChatSessionReset,
} from "@/lib/messaging/applicant-chat-session";
import { useApplicantMessagesRealtime } from "@/lib/messaging/useApplicantMessagesRealtime";

type AuthHeadersFn = () => Promise<Record<string, string> | null>;

export type SupportTicketCreatedPayload = {
  ticketId?: string;
  chatMessage?: ApplicantMessage;
};

export function useApplicantPortalMessaging({
  workerId,
  authHeaders,
}: {
  workerId: string | null | undefined;
  authHeaders: AuthHeadersFn;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ApplicantMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [recruiterDirectHint, setRecruiterDirectHint] = useState(false);
  const [skipNextAi, setSkipNextAi] = useState(false);
  const [lastInquiry, setLastInquiry] = useState("");

  const applySessionFilter = useCallback((items: ApplicantMessage[]) => {
    return filterApplicantMessagesForActiveSession(sortApplicantMessages(items));
  }, []);

  const setFilteredMessages = useCallback(
    (updater: ApplicantMessage[] | ((current: ApplicantMessage[]) => ApplicantMessage[])) => {
      setMessages((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        return applySessionFilter(next);
      });
    },
    [applySessionFilter]
  );

  useApplicantMessagesRealtime(workerId, setFilteredMessages, Boolean(workerId));

  const loadMessages = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/messages", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as { messages?: ApplicantMessage[] };
    if (res.ok) setMessages(applySessionFilter(payload.messages ?? []));
  }, [applySessionFilter, authHeaders]);

  const resetChatSession = useCallback(() => {
    markApplicantChatSessionReset();
    setMessages([]);
    setMessageBody("");
    setLastInquiry("");
    setRecruiterDirectHint(false);
    setSkipNextAi(false);
    setAiTyping(false);
    setSending(false);
  }, []);

  const requestAiResponse = useCallback(
    async (inquiry: string) => {
      setAiTyping(true);
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/applicant-portal/messages/ai-respond", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ inquiry }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          message?: ApplicantMessage;
          error?: string;
        };
        if (payload.message) {
          setFilteredMessages((current) => mergeApplicantMessage(current, payload.message!));
        }
      } finally {
        setAiTyping(false);
      }
    },
    [authHeaders, setFilteredMessages]
  );

  const handleSendMessage = useCallback(
    async (file?: File | null) => {
      const body = messageBody.trim();
      if (!body && !file) return;

      setSending(true);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");

        const formData = new FormData();
        if (body) formData.append("body", body);
        if (file) formData.append("file", file);
        const res = await fetch("/api/applicant-portal/messages", {
          method: "POST",
          headers,
          body: formData,
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: ApplicantMessage;
        };
        if (!res.ok) throw new Error(payload.error || "Could not send message.");

        setMessageBody("");
        setRecruiterDirectHint(false);
        if (payload.message) {
          setFilteredMessages((current) => mergeApplicantMessage(current, payload.message!));
        } else {
          await loadMessages();
        }

        const shouldAskAi = Boolean(body) && !file && !skipNextAi;
        if (shouldAskAi) {
          setLastInquiry(body);
          await requestAiResponse(body);
        }
        if (skipNextAi) setSkipNextAi(false);
      } catch (err) {
        throw err;
      } finally {
        setSending(false);
      }
    },
    [authHeaders, loadMessages, messageBody, requestAiResponse, setFilteredMessages, skipNextAi]
  );

  const handleContactRecruiter = useCallback(() => {
    setRecruiterDirectHint(true);
    setSkipNextAi(true);
  }, []);

  const handleSupportTicketCreated = useCallback(
    (payload: SupportTicketCreatedPayload) => {
      resetChatSession();
      if (payload.ticketId) {
        router.push(
          `/application/applicant-dashboard/tickets?ticket=${encodeURIComponent(payload.ticketId)}`
        );
      }
    },
    [resetChatSession, router]
  );

  return {
    messages,
    setMessages,
    messageBody,
    setMessageBody,
    sending,
    aiTyping,
    recruiterDirectHint,
    lastInquiry,
    loadMessages,
    resetChatSession,
    handleSendMessage,
    handleContactRecruiter,
    handleSupportTicketCreated,
  };
}
