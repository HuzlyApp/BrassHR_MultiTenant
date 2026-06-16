"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import ApplicantChatProfilePanel from "@/app/admin_recruiter/messages/ApplicantChatProfilePanel";
import ApplicantConversationClient from "@/app/admin_recruiter/messages/ApplicantConversationClient";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import {
  upsertConversationFromMessage,
  type StaffConversation,
} from "@/lib/messaging/staff-conversations";
import { useApplicantConversationsRealtime } from "@/lib/messaging/useApplicantConversationsRealtime";

type ConversationsResponse = {
  conversations?: StaffConversation[];
  tenantId?: string | null;
  unreadMessages?: number;
  error?: string;
};

const CHAT_PHONE_ICON = "/icons/chat-icons/phone-icon.svg";
const CHAT_VIDEO_ICON = "/icons/chat-icons/video-call-icon.svg";
const CHAT_MORE_ICON = "/icons/chat-icons/dots-horizontal.svg";

function ConversationAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{
        background: "linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)",
      }}
    >
      {nameInitials(name)}
    </div>
  );
}

export default function AdminRecruiterMessagesClient({
  initialWorkerId,
}: {
  initialWorkerId?: string | null;
}) {
  const [conversations, setConversations] = useState<StaffConversation[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialWorkerId ?? null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/admin/messages/conversations", { cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as ConversationsResponse;
    if (!res.ok) throw new Error(payload.error || "Could not load conversations.");
    setConversations(payload.conversations ?? []);
    setTenantId(payload.tenantId ?? null);
    return payload.conversations ?? [];
  }, []);

  const handleRealtimeInsert = useCallback(
    (message: Parameters<typeof upsertConversationFromMessage>[1]) => {
      setConversations((current) => upsertConversationFromMessage(current, message));
      void loadConversations();
    },
    [loadConversations]
  );

  useApplicantConversationsRealtime(tenantId, handleRealtimeInsert, !loading);

  useEffect(() => {
    if (initialWorkerId) {
      setSelectedWorkerId(initialWorkerId);
    }
  }, [initialWorkerId]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const items = await loadConversations();
        if (!alive) return;
        setSelectedWorkerId((current) => current ?? items[0]?.workerId ?? null);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not load conversations.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadConversations]);

  const selectedConversation = conversations.find((item) => item.workerId === selectedWorkerId) ?? null;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.applicantName.toLowerCase().includes(query) ||
        conversation.preview.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const unreadConversations = filteredConversations.filter((item) => item.unreadCount > 0);
  const readConversations = filteredConversations.filter((item) => item.unreadCount === 0);

  return (
    <main className="overflow-x-hidden bg-[#F4F4F4] p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#0F172A]">Messages</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Chat with applicants. New messages show up live.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:h-[calc(100vh-190px)] lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-3 lg:items-stretch xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(220px,280px)] 2xl:grid-cols-[306px_minmax(0,1fr)_306px] 2xl:gap-6">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm xl:h-full">
          <div className="border-b border-[#E8EDF2] p-4">
            <div className="relative mx-auto w-full max-w-[266px]">
              <Search className="pointer-events-none absolute left-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                className="h-8 w-full rounded-[8px] border border-[#D8E0EA] bg-[#F8FAFC] py-2 pl-9 pr-[10px] text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-(--brand-primary)"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 px-1">
              <button
                type="button"
                className="border-b-2 pb-2 text-[12px] font-semibold leading-4"
                style={{
                  borderColor: "var(--brand-primary)",
                  color: "#0F2F62",
                }}
              >
                Worker
                {unreadConversations.length > 0 ? (
                  <span className="ml-1 align-top text-[#E11D48]">•</span>
                ) : null}
              </button>
              <button
                type="button"
                className="pb-2 text-[12px] font-medium leading-4 text-[#667085]"
              >
                Group
                {unreadConversations.length > 0 ? (
                  <span className="ml-1 align-top text-[#E11D48]">•</span>
                ) : null}
              </button>
              <button
                type="button"
                className="pb-2 text-[12px] font-medium leading-4 text-[#667085]"
              >
                Support
                {unreadConversations.length > 0 ? (
                  <span className="ml-1 align-top text-[#E11D48]">•</span>
                ) : null}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <CandidateDetailLoader label="Loading conversations..." className="min-h-[240px] py-10" />
            ) : null}
            {!loading && filteredConversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#64748B]">
                {searchQuery.trim()
                  ? "No chats match your search."
                  : "No applicant messages yet. Approved applicants can message you from their dashboard."}
              </p>
            ) : null}

            {unreadConversations.length > 0 ? (
              <div className="px-3 pt-3">
                {unreadConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.workerId}
                    conversation={conversation}
                    active={conversation.workerId === selectedWorkerId}
                    onSelect={() => setSelectedWorkerId(conversation.workerId)}
                  />
                ))}
              </div>
            ) : null}

            {readConversations.length > 0 ? (
              <div className="px-3 py-3">
                {readConversations.map((conversation) => (
                  <ConversationListItem
                    key={conversation.workerId}
                    conversation={conversation}
                    active={conversation.workerId === selectedWorkerId}
                    onSelect={() => setSelectedWorkerId(conversation.workerId)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm xl:h-full">
          {selectedWorkerId && selectedConversation ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[#E8EDF2] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <ConversationAvatar name={selectedConversation.applicantName} />
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold leading-5 text-[#0F172A]">
                      {selectedConversation.applicantName}
                    </h2>
                    <p className="text-xs text-[#64748B]">Applicant chat</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label="Call applicant"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
                  >
                    <Image
                      src={CHAT_PHONE_ICON}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0"
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Video call applicant"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
                  >
                    <Image
                      src={CHAT_VIDEO_ICON}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0"
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="More options"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
                  >
                    <Image
                      src={CHAT_MORE_ICON}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 shrink-0"
                      aria-hidden
                    />
                  </button>
                </div>
              </div>
              <ApplicantConversationClient
                workerId={selectedWorkerId}
                applicantName={selectedConversation.applicantName}
                compact
                showHeader={false}
              />
            </>
          ) : (
            <div
              className="flex h-full min-h-[360px] flex-1 items-center justify-center px-6 text-center"
              style={{ backgroundColor: "#F4F4F4" }}
            >
              {loading ? (
                <CandidateDetailLoader label="Loading conversations..." className="min-h-0 bg-transparent py-0" />
              ) : (
                <p className="max-w-sm text-sm text-[#64748B]">Pick a chat to read and reply.</p>
              )}
            </div>
          )}
        </section>

        <div className="hidden xl:block">
          {selectedWorkerId && selectedConversation ? (
            <ApplicantChatProfilePanel
              workerId={selectedWorkerId}
              applicantName={selectedConversation.applicantName}
            />
          ) : (
            <aside className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-white px-6 text-center shadow-sm xl:h-full">
              <p className="text-sm text-[#64748B]">Select a chat to see profile details.</p>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function ConversationListItem({
  conversation,
  active,
  onSelect,
}: {
  conversation: StaffConversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mb-2 flex h-[55px] w-full items-center gap-2 rounded-md border bg-white px-3 py-3 text-left transition ${
        active
          ? "border-(--brand-primary)"
          : "border-[#E2E8F0] hover:border-(--brand-primary)"
      }`}
    >
      <div className="shrink-0 scale-90">
        <ConversationAvatar name={conversation.applicantName} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[12px] font-normal leading-4 text-[#0F172A]">{conversation.applicantName}</p>
          {conversation.unreadCount > 0 ? (
            <span className="inline-flex h-[18px] w-[18px] min-h-[18px] min-w-[18px] max-h-[18px] shrink-0 items-center justify-center rounded-full bg-[#E11D48] px-[2px] text-[11px] font-semibold leading-none text-white">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[10px] font-normal leading-[15px] text-[#64748B]">{conversation.preview}</p>
      </div>
    </button>
  );
}
