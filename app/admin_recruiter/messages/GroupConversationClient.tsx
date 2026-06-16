"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import { relativeChatMinutes, type GroupMessageRow } from "@/lib/messaging/group-conversations";
import { useGroupMessagesRealtime } from "@/lib/messaging/useGroupMessagesRealtime";
import ChatEmojiPicker from "@/app/components/ChatEmojiPicker";

const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

function MessageAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{
        background:
          "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      {nameInitials(name)}
    </div>
  );
}

export default function GroupConversationClient({
  groupId,
  groupName,
  memberCount,
}: {
  groupId: string;
  groupName: string;
  memberCount: number;
}) {
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/admin/messages/groups/${encodeURIComponent(groupId)}/messages`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      messages?: GroupMessageRow[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(payload.messages ?? []);
  }, [groupId]);

  useGroupMessagesRealtime(groupId, setMessages, !loading);

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
  }, [groupId, loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = body.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/messages/groups/${encodeURIComponent(groupId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not send message.");
      setBody("");
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <CandidateDetailLoader label="Loading messages..." className="min-h-0 flex-1 bg-transparent py-8" />
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-2xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
            No messages in {groupName} yet. Say hello to your {memberCount} member
            {memberCount === 1 ? "" : "s"}.
          </p>
        ) : null}
        {!loading
          ? messages.map((message) => {
              const isRecruiter = message.sender_role === "recruiter";
              return (
                <div
                  key={message.id}
                  className={`flex w-fit max-w-[78%] flex-col ${isRecruiter ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  <div
                    className="w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-6"
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
                    <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
                  </div>
                  <div className={`mt-2 flex items-center gap-2 ${isRecruiter ? "flex-row-reverse" : ""}`}>
                    <MessageAvatar name={message.sender_name} />
                    <p className="text-xs text-[#64748B]">
                      <span className="font-medium text-[#334155]">{message.sender_name}</span>
                      {" · "}
                      {relativeChatMinutes(message.sent_at) || formatChatTime(message.sent_at)}
                    </p>
                  </div>
                </div>
              );
            })
          : null}
      </div>

      <form onSubmit={handleSend} className="border-t border-[#E8EDF2] bg-white px-5 py-4">
        {error ? (
          <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        <div className="flex min-h-[60px] w-full items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2">
          <textarea
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Write a message"
            rows={1}
            className="h-[54px] min-h-[54px] flex-1 resize-none border-0 bg-transparent py-[4px] text-sm leading-5 text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <div className="flex shrink-0 items-center gap-2">
            <ChatEmojiPicker
              onSelect={(emoji) => {
                setBody((current) => current + emoji);
                if (error) setError(null);
              }}
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              aria-label="Send message"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
              }}
            >
              <Image src={CHAT_SEND_ICON} alt="" width={16} height={16} className="h-4 w-4 shrink-0" aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
