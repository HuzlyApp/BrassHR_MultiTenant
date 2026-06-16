"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import {
  mergeApplicantMessage,
  sortApplicantMessages,
  type ApplicantMessage,
} from "@/lib/messaging/applicant-messages";
import { useApplicantMessagesRealtime } from "@/lib/messaging/useApplicantMessagesRealtime";

const CHAT_ATTACH_ICON = "/icons/chat-icons/attach_file.svg";
const CHAT_EMOJI_ICON = "/icons/chat-icons/emoji-happy.svg";
const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

function ChatAvatar({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "accent";
}) {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={
        variant === "primary"
          ? {
              background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              color: "#ffffff",
            }
          : {
              background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-accent) 70%, white) 0%, color-mix(in srgb, var(--brand-primary) 20%, white) 100%)",
              color: "var(--brand-secondary)",
            }
      }
    >
      {nameInitials(label)}
    </div>
  );
}

export default function ApplicantConversationClient({
  workerId,
  compact = false,
  applicantName = "Applicant",
  showHeader = true,
}: {
  workerId: string;
  compact?: boolean;
  applicantName?: string;
  showHeader?: boolean;
}) {
  const branding = useTenantBranding();
  const recruiterLabel = branding.companyName?.trim() || "Recruiter";
  const [messages, setMessages] = useState<ApplicantMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/applicant-portal/messages?workerId=${encodeURIComponent(workerId)}`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as { messages?: ApplicantMessage[]; error?: string };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(sortApplicantMessages(payload.messages ?? []));
  }, [workerId]);

  useApplicantMessagesRealtime(workerId, setMessages, !loading);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await loadMessages();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load messages.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/applicant-portal/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, body: message }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: ApplicantMessage;
      };
      if (!res.ok) throw new Error(payload.error || "Could not send reply.");

      setBody("");
      if (payload.message) {
        setMessages((current) => mergeApplicantMessage(current, payload.message!));
      } else {
        await loadMessages();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
          : "mt-6 flex max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
      }
    >
      {!compact && showHeader ? (
        <div className="border-b border-[#E8EDF2] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">{applicantName}</h2>
          <p className="mt-1 text-sm text-[#64748B]">Applicant conversation</p>
        </div>
      ) : null}

      {error ? (
        <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex min-h-[280px] flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <CandidateDetailLoader label="Loading messages..." className="min-h-0 flex-1 bg-transparent py-8" />
        ) : null}
        {!loading && messages.length === 0 ? (
          <p
            className="rounded-2xl px-4 py-3 text-sm text-[#64748B]"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-accent) 18%, white)" }}
          >
            No applicant messages yet.
          </p>
        ) : null}
        {!loading
          ? messages.map((message) => {
          const isRecruiter = message.sender_role === "recruiter";
          const senderName = isRecruiter ? recruiterLabel : applicantName;
          return (
            <div
              key={message.id}
              className={`flex max-w-[78%] flex-col ${isRecruiter ? "ml-auto items-end" : "mr-auto items-start"}`}
            >
              <div
                className="rounded-2xl px-4 py-3 text-sm leading-6"
                style={
                  isRecruiter
                    ? {
                        background:
                          "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "#ECF1F9",
                        color: "#1E293B",
                      }
                }
              >
                {message.body}
              </div>
              <div className={`mt-2 flex items-center gap-2 ${isRecruiter ? "flex-row-reverse" : ""}`}>
                <ChatAvatar label={senderName} variant={isRecruiter ? "primary" : "accent"} />
                <p className="text-xs text-[#64748B]">
                  <span className="font-medium text-[#334155]">{senderName}</span>
                  {" · "}
                  {formatChatTime(message.created_at)}
                </p>
              </div>
            </div>
          );
        })
          : null}
      </div>

      <form onSubmit={handleSend} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
        <div className="flex w-full min-h-[60px] items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message"
            rows={1}
            className="h-[54px] min-h-[54px] flex-1 resize-none border-0 bg-transparent py-[4px] text-sm leading-5 text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Attach file"
              className="inline-flex h-6 w-6 items-center justify-center transition hover:opacity-80"
            >
              <Image
                src={CHAT_ATTACH_ICON}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
                aria-hidden
              />
            </button>
            <button
              type="button"
              aria-label="Add emoji"
              className="inline-flex h-6 w-6 items-center justify-center transition hover:opacity-80"
            >
              <Image
                src={CHAT_EMOJI_ICON}
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
                aria-hidden
              />
            </button>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              aria-label="Send message"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              <Image
                src={CHAT_SEND_ICON}
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
