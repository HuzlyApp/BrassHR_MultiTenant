"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bot, User } from "lucide-react";
import type {
  HelpAssistantResponse,
  HelpAssistantButton,
} from "@/lib/applicant-portal/help-assistant-types";
import { HELP_TICKET_FAILED_MESSAGE } from "@/lib/applicant-portal/help-assistant-types";
import { useApplicantPortalAuthHeaders } from "./useApplicantPortalSession";
import { useApplicantPortalUi } from "./ApplicantPortalUiContext";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

type ChatItem =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      buttons?: HelpAssistantButton[];
      variant?: "answer" | "fallback" | "ticket";
    };

function HelpActionButton({
  button,
  lastInquiry,
  onTicketCreated,
  onTicketFailed,
}: {
  button: HelpAssistantButton;
  lastInquiry: string;
  onTicketCreated: (payload: HelpAssistantResponse) => void;
  onTicketFailed: (message: string) => void;
}) {
  const authHeaders = useApplicantPortalAuthHeaders();
  const { openRecruiterMessages } = useApplicantPortalUi();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (button.action === "message_recruiter") {
      openRecruiterMessages();
      return;
    }

    setPending(true);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const inquiry = lastInquiry.trim() || "Support request from applicant portal";

      const res = await fetch("/api/applicant-portal/help/support-ticket", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry, description: inquiry, category: "general" }),
      });
      const payload = (await res.json().catch(() => ({}))) as HelpAssistantResponse & {
        message?: string;
      };
      if (!res.ok) throw new Error(payload.message || HELP_TICKET_FAILED_MESSAGE);
      onTicketCreated(payload);
    } catch (err) {
      onTicketFailed(err instanceof Error ? err.message : HELP_TICKET_FAILED_MESSAGE);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      className="rounded-full border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait..." : button.label}
    </button>
  );
}

function AssistantBubble({
  item,
  lastInquiry,
  onTicketCreated,
  onTicketFailed,
}: {
  item: Extract<ChatItem, { role: "assistant" }>;
  lastInquiry: string;
  onTicketCreated: (payload: HelpAssistantResponse) => void;
  onTicketFailed: (message: string) => void;
}) {
  return (
    <div className="mr-auto flex w-fit max-w-[85%] items-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[#475569]">
        <Bot className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="rounded-2xl bg-[#ECF1F9] px-4 py-3 text-sm leading-6 text-[#1E293B]">
          <p className="whitespace-pre-wrap wrap-break-word">{item.text}</p>
        </div>
        {item.buttons?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.buttons.map((button) => (
              <HelpActionButton
                key={button.action}
                button={button}
                lastInquiry={lastInquiry}
                onTicketCreated={onTicketCreated}
                onTicketFailed={onTicketFailed}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ApplicantHelpSupportTab() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [items, setItems] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I can help with questions about the applicant portal, documents, onboarding, and messaging your recruiter. What can I help you with?",
      variant: "answer",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInquiry, setLastInquiry] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    });
  }

  function appendAssistantFromResponse(payload: HelpAssistantResponse) {
    if (payload.type === "answer") {
      setItems((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.message,
          variant: "answer",
        },
      ]);
      return;
    }

    if (payload.type === "fallback") {
      setItems((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.message,
          buttons: payload.buttons,
          variant: "fallback",
        },
      ]);
      return;
    }

    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: payload.message,
        variant: "ticket",
      },
    ]);
  }

  useEffect(() => {
    scrollToBottom();
  }, [items, loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const inquiry = input.trim();
    if (!inquiry || loading) return;

    setLastInquiry(inquiry);
    setItems((current) => [...current, { id: crypto.randomUUID(), role: "user", text: inquiry }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch("/api/applicant-portal/help/ask", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ inquiry }),
      });
      const payload = (await res.json().catch(() => ({}))) as HelpAssistantResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not process your question.");
      appendAssistantFromResponse(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process your question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-8 py-6">
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} flex min-h-[560px] flex-col overflow-hidden`}>
        <div className="border-b border-[#E5E7EB] px-5 py-4">
          <h1 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
            Help & Support
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Answers come from your organization&apos;s help articles only.
          </p>
        </div>

        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {items.map((item) =>
            item.role === "user" ? (
              <div key={item.id} className="ml-auto flex w-fit max-w-[85%] items-start gap-2">
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-6 text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                  }}
                >
                  <p className="whitespace-pre-wrap wrap-break-word">{item.text}</p>
                </div>
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[#475569]">
                  <User className="h-4 w-4" aria-hidden />
                </div>
              </div>
            ) : (
              <AssistantBubble
                key={item.id}
                item={item}
                lastInquiry={lastInquiry}
                onTicketCreated={appendAssistantFromResponse}
                onTicketFailed={(message) =>
                  setItems((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      text: message,
                      variant: "fallback",
                    },
                  ])
                }
              />
            )
          )}
          {loading ? <p className="text-sm text-[#64748B]">Searching help articles...</p> : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
          {error ? (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}
          <div className="flex min-h-[60px] w-full items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Ask a question about the portal, documents, or hiring process"
              rows={1}
              className="h-[54px] min-h-[54px] flex-1 resize-none border-0 bg-transparent py-[4px] text-sm leading-5 text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send question"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              <Image src={CHAT_SEND_ICON} alt="" width={16} height={16} className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
