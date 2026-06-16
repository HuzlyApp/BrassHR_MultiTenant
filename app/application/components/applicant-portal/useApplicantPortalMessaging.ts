"use client";

import { useCallback, useState } from "react";
import type { ApplicantMessage } from "@/app/application/components/applicant-portal/types";
import {
  mergeApplicantMessage,
  sortApplicantMessages,
} from "@/lib/messaging/applicant-messages";
import { useApplicantMessagesRealtime } from "@/lib/messaging/useApplicantMessagesRealtime";

type AuthHeadersFn = () => Promise<Record<string, string> | null>;

export function useApplicantPortalMessaging({
  workerId,
  authHeaders,
}: {
  workerId: string | null | undefined;
  authHeaders: AuthHeadersFn;
}) {
  const [messages, setMessages] = useState<ApplicantMessage[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [recruiterDirectHint, setRecruiterDirectHint] = useState(false);
  const [skipNextAi, setSkipNextAi] = useState(false);
  const [lastInquiry, setLastInquiry] = useState("");

  useApplicantMessagesRealtime(workerId, setMessages, Boolean(workerId));

  const loadMessages = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/messages", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as { messages?: ApplicantMessage[] };
    if (res.ok) setMessages(sortApplicantMessages(payload.messages ?? []));
  }, [authHeaders]);

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
          setMessages((current) => mergeApplicantMessage(current, payload.message!));
        }
      } finally {
        setAiTyping(false);
      }
    },
    [authHeaders]
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
          setMessages((current) => mergeApplicantMessage(current, payload.message!));
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
    [authHeaders, loadMessages, messageBody, requestAiResponse, skipNextAi]
  );

  const handleContactRecruiter = useCallback(() => {
    setRecruiterDirectHint(true);
    setSkipNextAi(true);
  }, []);

  const handleCreateSupportTicket = useCallback(
    async (inquiry: string) => {
      setAiTyping(true);
      try {
        const headers = await authHeaders();
        if (!headers) throw new Error("You need to sign in again.");
        const res = await fetch("/api/applicant-portal/messages/ai-ticket", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ inquiry }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          chatMessage?: ApplicantMessage;
          message?: ApplicantMessage;
        };
        const chatMessage = payload.chatMessage ?? payload.message;
        if (chatMessage) {
          setMessages((current) => mergeApplicantMessage(current, chatMessage));
        }
      } finally {
        setAiTyping(false);
      }
    },
    [authHeaders]
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
    handleSendMessage,
    handleContactRecruiter,
    handleCreateSupportTicket,
  };
}
