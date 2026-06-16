"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Users } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import { relativeChatMinutes, type GroupMessageRow } from "@/lib/messaging/group-conversations";
import { useGroupMessagesRealtime } from "@/lib/messaging/useGroupMessagesRealtime";
import { useApplicantPortalAuthHeaders } from "./useApplicantPortalSession";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import ChatEmojiPicker from "@/app/components/ChatEmojiPicker";

const CHAT_SEND_ICON = "/icons/chat-icons/send.svg";

type AssignedGroup = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  members: { id: string; name: string }[];
  preview: string;
  sentAt: string | null;
};

type GroupMember = {
  id: string;
  name: string;
  joinedAt: string;
};

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

function ApplicantGroupConversation({
  groupId,
  groupName,
  members,
  applicantWorkerId,
}: {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  applicantWorkerId: string;
}) {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) throw new Error("You need to sign in again.");
    const res = await fetch(`/api/applicant-portal/groups/${encodeURIComponent(groupId)}/messages`, {
      headers,
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      messages?: GroupMessageRow[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load messages.");
    setMessages(payload.messages ?? []);
  }, [authHeaders, groupId]);

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
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(`/api/applicant-portal/groups/${encodeURIComponent(groupId)}/messages`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[#E5E7EB] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">{groupName}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {members.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs text-[#334155]"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                {nameInitials(member.name)}
              </span>
              {member.name}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-[320px] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <CandidateDetailLoader label="Loading messages..." className="min-h-0 flex-1 bg-transparent py-8" />
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="rounded-2xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
            No messages in this group yet. Say hello to your team.
          </p>
        ) : null}
        {!loading
          ? messages.map((message) => {
              const isSelf = message.sender_role === "worker" && message.sender_id === applicantWorkerId;
              return (
                <div
                  key={message.id}
                  className={`flex w-fit max-w-[85%] flex-col ${isSelf ? "ml-auto items-end" : "mr-auto items-start"}`}
                >
                  <div
                    className="w-fit max-w-full rounded-2xl px-4 py-3 text-sm leading-6"
                    style={
                      isSelf
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
                  <div className={`mt-2 flex items-center gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
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

      <form onSubmit={handleSend} className="border-t border-[#E8EDF2] bg-white px-4 py-4">
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

export function ApplicantGroupChatTab() {
  const authHeaders = useApplicantPortalAuthHeaders();
  const [applicantWorkerId, setApplicantWorkerId] = useState<string | null>(null);
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const sessionRes = await fetch("/api/applicant-portal/session", { headers, cache: "no-store" });
        const sessionPayload = (await sessionRes.json().catch(() => ({}))) as {
          applicant?: { id: string };
        };
        if (!sessionRes.ok || !sessionPayload.applicant?.id) {
          throw new Error("Could not load applicant session.");
        }
        if (!alive) return;
        setApplicantWorkerId(sessionPayload.applicant.id);

        const res = await fetch("/api/applicant-portal/groups", { headers, cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as {
          groups?: AssignedGroup[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load group chats.");
        if (!alive) return;
        const items = payload.groups ?? [];
        setGroups(items);
        setSelectedGroupId(items[0]?.id ?? null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load group chats.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }
    const selected = groups.find((group) => group.id === selectedGroupId);
    if (selected) {
      setMembers(
        selected.members.map((member) => ({
          id: member.id,
          name: member.name,
          joinedAt: "",
        }))
      );
      return;
    }
    let alive = true;
    void (async () => {
      const headers = await authHeaders();
      if (!headers) return;
      const res = await fetch(
        `/api/applicant-portal/groups/${encodeURIComponent(selectedGroupId)}/messages`,
        { headers, cache: "no-store" }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        group?: { members: GroupMember[] };
      };
      if (!alive || !res.ok) return;
      setMembers(payload.group?.members ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [authHeaders, groups, selectedGroupId]);

  if (loading || !applicantWorkerId) {
    return <p className="px-8 py-10 text-sm text-[#64748B]">Loading group chat...</p>;
  }

  if (error) {
    return (
      <div className="px-8 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center px-8 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]">
          <Users className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-[#0F172A]">No group chat has been assigned yet.</h2>
        <p className="mt-2 max-w-md text-sm text-[#64748B]">
          When your recruiter adds you to a group, it will appear here and you can message the team.
        </p>
      </div>
    );
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];

  return (
    <div className="px-8 py-6">
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} flex min-h-[560px] overflow-hidden`}>
        {groups.length > 1 ? (
          <aside className="w-[240px] shrink-0 border-r border-[#E5E7EB] bg-[#FAFBFC]">
            <div className="border-b border-[#E5E7EB] px-4 py-3">
              <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
                Your groups
              </h2>
            </div>
            <div className="p-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition ${
                    group.id === selectedGroup?.id ? "bg-white shadow-sm" : "hover:bg-white/70"
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-[#0F172A]">{group.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#64748B]">
                    {group.memberCount} members · {group.preview}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedGroup ? (
            <ApplicantGroupConversation
              groupId={selectedGroup.id}
              groupName={selectedGroup.name}
              members={members.length > 0 ? members : selectedGroup.members.map((m) => ({ ...m, joinedAt: "" }))}
              applicantWorkerId={applicantWorkerId}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
