"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { Pin, Search, UserPlus } from "lucide-react";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";
import ApplicantChatProfilePanel from "@/app/admin_recruiter/messages/ApplicantChatProfilePanel";
import ApplicantConversationClient from "@/app/admin_recruiter/messages/ApplicantConversationClient";
import SupportConversationClient from "@/app/admin_recruiter/messages/SupportConversationClient";
import CreateGroupModal from "@/app/admin_recruiter/messages/CreateGroupModal";
import GroupChatProfilePanel from "@/app/admin_recruiter/messages/GroupChatProfilePanel";
import GroupConversationClient from "@/app/admin_recruiter/messages/GroupConversationClient";
import GroupStackedAvatars from "@/app/admin_recruiter/messages/GroupStackedAvatars";
import { formatChatTime, nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import type { StaffGroupConversation } from "@/lib/messaging/group-conversations";
import type { StaffConversation } from "@/lib/messaging/staff-conversations";
import { useStaffConversations } from "@/lib/messaging/hooks/use-staff-conversations";
import { useMarkConversationRead } from "@/lib/messaging/hooks/use-mark-conversation-read";
import { useApplicantConversationsRealtime } from "@/lib/messaging/useApplicantConversationsRealtime";
import { safeFetchJson } from "@/lib/api/safe-fetch-json";
import type { SupportTicketConversationItem, SupportTicketStatus } from "@/lib/support-tickets/types";

type ChatTab = "worker" | "group" | "support";

type GroupsResponse = {
  groups?: StaffGroupConversation[];
  tenantId?: string | null;
  error?: string;
};

const CHAT_PHONE_ICON = "/icons/chat-icons/phone-icon.svg";
const CHAT_VIDEO_ICON = "/icons/chat-icons/video-call-icon.svg";
const CHAT_MORE_ICON = "/icons/chat-icons/dots-horizontal.svg";
const PINNED_STORAGE_KEY = "admin-recruiter-pinned-worker-chats";

const SUPPORT_STATUS_COLORS: Record<SupportTicketStatus, string> = {
  Open: "bg-[#DBEAFE] text-[#1D4ED8]",
  Pending: "bg-[#FEF3C7] text-[#B45309]",
  "In Progress": "bg-[#E0E7FF] text-[#4338CA]",
  Resolved: "bg-[#D1FAE5] text-[#047857]",
  Closed: "bg-[#F1F5F9] text-[#64748B]",
};

function ConversationAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  const trimmedPhoto = photoUrl?.trim();
  if (trimmedPhoto) {
    return (
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#E2E8F0]">
        <Image src={trimmedPhoto} alt="" fill className="object-cover" sizes="40px" unoptimized />
      </div>
    );
  }

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

function ChatTabButton({
  label,
  active,
  showDot,
  onClick,
}: {
  label: string;
  active: boolean;
  showDot?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 pb-2 text-[12px] leading-4 ${
        active ? "border-b-2 font-semibold text-[#0F2F62]" : "font-normal text-[#667085]"
      }`}
      style={active ? { borderColor: "var(--brand-primary)" } : undefined}
    >
      {label}
      {showDot ? <span className="text-[#E11D48]">•</span> : null}
    </button>
  );
}

function readPinnedWorkerIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminRecruiterMessagesClient({
  initialWorkerId,
}: {
  initialWorkerId?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ChatTab>("worker");
  const {
    conversations,
    tenantId,
    isLoading: conversationsLoading,
    refetch: refetchConversations,
  } = useStaffConversations();
  const markConversationRead = useMarkConversationRead();
  const [groups, setGroups] = useState<StaffGroupConversation[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(initialWorkerId ?? null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [pinnedWorkerIds, setPinnedWorkerIds] = useState<string[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketConversationItem[]>([]);
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<string | null>(null);
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    setPinnedWorkerIds(readPinnedWorkerIds());
  }, []);

  useEffect(() => {
    if (!selectedWorkerId || activeTab !== "worker") return;
    void markConversationRead(selectedWorkerId);
  }, [selectedWorkerId, activeTab, markConversationRead]);

  const selectWorkerConversation = useCallback(
    (workerId: string) => {
      setSelectedWorkerId(workerId);
      setSelectedGroupId(null);
    },
    []
  );

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch("/api/admin/messages/groups", { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as GroupsResponse;
      if (!res.ok) throw new Error(payload.error || "Could not load groups.");
      setGroups(payload.groups ?? []);
      return payload.groups ?? [];
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  const loadSupportTickets = useCallback(async () => {
    setSupportLoading(true);
    try {
      const result = await safeFetchJson<{ tickets?: SupportTicketConversationItem[] }>(
        "/api/support-tickets",
        { cache: "no-store", credentials: "include" }
      );
      if (!result.ok) throw new Error(result.error);
      const items = result.data.tickets ?? [];
      setSupportTickets(items);
      return items;
    } finally {
      setSupportLoading(false);
    }
  }, []);

  const handleRealtimeInsert = useCallback(() => {
    void refetchConversations();
  }, [refetchConversations]);

  useApplicantConversationsRealtime(tenantId, handleRealtimeInsert, !loading && activeTab === "worker");

  useEffect(() => {
    if (initialWorkerId) {
      setSelectedWorkerId(initialWorkerId);
      setActiveTab("worker");
    }
  }, [initialWorkerId]);

  useEffect(() => {
    if (conversationsLoading) return;
    setSelectedWorkerId((current) => current ?? conversations[0]?.workerId ?? null);
    setLoading(false);
  }, [conversations, conversationsLoading]);

  useEffect(() => {
    if (activeTab !== "group") return;
    void loadGroups().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load groups.");
    });
  }, [activeTab, loadGroups]);

  useEffect(() => {
    if (activeTab !== "support") return;
    void loadSupportTickets()
      .then((items) => {
        setSelectedSupportTicketId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load support tickets.");
      });
  }, [activeTab, loadSupportTickets]);

  const selectedConversation = conversations.find((item) => item.workerId === selectedWorkerId) ?? null;
  const selectedGroup = groups.find((item) => item.id === selectedGroupId) ?? null;
  const selectedSupportTicket =
    supportTickets.find((item) => item.id === selectedSupportTicketId) ?? null;

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.applicantName.toLowerCase().includes(query) ||
        conversation.preview.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.preview.toLowerCase().includes(query) ||
        group.memberNames.some((name) => name.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  const filteredSupportTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return supportTickets;
    return supportTickets.filter(
      (ticket) =>
        (ticket.subject ?? "").toLowerCase().includes(query) ||
        ticket.lastMessagePreview.toLowerCase().includes(query) ||
        (ticket.applicant_name ?? "").toLowerCase().includes(query) ||
        (ticket.applicant_email ?? "").toLowerCase().includes(query) ||
        (ticket.category ?? "").toLowerCase().includes(query)
    );
  }, [searchQuery, supportTickets]);

  const pinnedConversations = filteredConversations.filter((item) => pinnedWorkerIds.includes(item.workerId));
  const unpinnedConversations = filteredConversations.filter((item) => !pinnedWorkerIds.includes(item.workerId));
  const unreadConversations = filteredConversations.filter((item) => item.unreadCount > 0);

  function togglePin(workerId: string) {
    setPinnedWorkerIds((current) => {
      const next = current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId];
      window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <main className="overflow-x-hidden bg-[#F4F4F4] p-4 md:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#0F172A]">Messages</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Chat with applicants and manage worker groups. New messages show up live.
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
            <div className="relative w-full max-w-none sm:mx-auto sm:max-w-[266px]">
              <Search className="pointer-events-none absolute left-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                className="h-8 w-full rounded-[8px] border border-[#D8E0EA] bg-[#F8FAFC] py-2 pl-9 pr-[10px] text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-(--brand-primary)"
              />
            </div>
            <div className="mt-4 grid w-full grid-cols-3 items-center gap-2 px-0 sm:flex sm:w-auto sm:gap-6 sm:px-1 [&>button]:justify-center">
              <ChatTabButton
                label="Worker"
                active={activeTab === "worker"}
                showDot={unreadConversations.length > 0}
                onClick={() => setActiveTab("worker")}
              />
              <ChatTabButton
                label="Group"
                active={activeTab === "group"}
                onClick={() => {
                  setActiveTab("group");
                  setSelectedWorkerId(null);
                }}
              />
              <ChatTabButton
                label="Support"
                active={activeTab === "support"}
                onClick={() => {
                  setActiveTab("support");
                  setSelectedWorkerId(null);
                  setSelectedGroupId(null);
                }}
              />
            </div>
          </div>

          {activeTab === "group" ? (
            <div className="border-b border-[#E8EDF2] px-4 py-3.5">
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] text-[12px] font-semibold text-[#0F2F62] transition hover:bg-[#F8FAFC]"
              >
                <UserPlus className="h-4 w-4" />
                Create a new group
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "worker" ? (
              <>
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

                {pinnedConversations.length > 0 ? (
                  <div className="px-3 pt-3">
                    <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-semibold text-[#0F172A]">
                      <Pin className="h-4 w-4 text-[#64748B]" />
                      Pinned
                    </div>
                    {pinnedConversations.map((conversation) => (
                      <ConversationListItem
                        key={conversation.workerId}
                        conversation={conversation}
                        active={conversation.workerId === selectedWorkerId}
                        pinned
                          onSelect={() => selectWorkerConversation(conversation.workerId)}
                        onTogglePin={() => togglePin(conversation.workerId)}
                      />
                    ))}
                  </div>
                ) : null}

                {unpinnedConversations.length > 0 ? (
                  <div className="px-3 py-3">
                    {pinnedConversations.length > 0 ? (
                      <p className="mb-2 px-1 text-[12px] font-semibold text-[#0F172A]">All</p>
                    ) : null}
                    {unpinnedConversations.map((conversation) => (
                      <ConversationListItem
                        key={conversation.workerId}
                        conversation={conversation}
                        active={conversation.workerId === selectedWorkerId}
                          onSelect={() => selectWorkerConversation(conversation.workerId)}
                        onTogglePin={() => togglePin(conversation.workerId)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeTab === "group" ? (
              <>
                {groupsLoading ? (
                  <CandidateDetailLoader label="Loading groups..." className="min-h-[240px] py-10" />
                ) : null}
                {!groupsLoading && filteredGroups.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#64748B]">
                    {searchQuery.trim()
                      ? "No groups match your search."
                      : "No groups yet. Create one to message multiple workers together."}
                  </p>
                ) : null}
                {!groupsLoading && filteredGroups.length > 0 ? (
                  <div className="px-3 py-3">
                    <p className="mb-2 px-1 text-[16px] font-semibold text-[#0F172A]">Group</p>
                    {filteredGroups.map((group) => (
                      <GroupListItem
                        key={group.id}
                        group={group}
                        active={group.id === selectedGroupId}
                        onSelect={() => {
                          setSelectedGroupId(group.id);
                          setSelectedWorkerId(null);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {activeTab === "support" ? (
              <>
                {supportLoading ? (
                  <CandidateDetailLoader label="Loading support tickets..." className="min-h-[240px] py-10" />
                ) : null}
                {!supportLoading && filteredSupportTickets.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#64748B]">
                    {searchQuery.trim()
                      ? "No support tickets match your search."
                      : "No worker support tickets yet."}
                  </p>
                ) : null}
                {!supportLoading && filteredSupportTickets.length > 0 ? (
                  <div className="px-3 py-3">
                    <p className="mb-2 px-1 text-[16px] font-semibold text-[#0F172A]">Support</p>
                    {filteredSupportTickets.map((ticket) => (
                      <SupportTicketListItem
                        key={ticket.id}
                        ticket={ticket}
                        active={ticket.id === selectedSupportTicketId}
                        onSelect={() => {
                          setSelectedSupportTicketId(ticket.id);
                          setSelectedWorkerId(null);
                          setSelectedGroupId(null);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm xl:h-full">
          {activeTab === "worker" && selectedWorkerId && selectedConversation ? (
            <>
              <ChatHeader
                title={selectedConversation.applicantName}
                subtitle="Applicant chat"
                avatar={<ConversationAvatar name={selectedConversation.applicantName} photoUrl={selectedConversation.profilePhotoUrl} />}
              />
              <ApplicantConversationClient
                workerId={selectedWorkerId}
                applicantName={selectedConversation.applicantName}
                compact
                showHeader={false}
              />
            </>
          ) : activeTab === "group" && selectedGroupId && selectedGroup ? (
            <>
              <ChatHeader
                title={selectedGroup.name}
                subtitle={`${selectedGroup.memberCount} Active Members`}
                avatar={<GroupStackedAvatars initials={selectedGroup.memberInitials} size={30} max={3} />}
              />
              <GroupConversationClient
                groupId={selectedGroupId}
                groupName={selectedGroup.name}
                memberCount={selectedGroup.memberCount}
              />
            </>
          ) : activeTab === "support" && selectedSupportTicketId && selectedSupportTicket ? (
            <>
              <ChatHeader
                title={selectedSupportTicket.applicant_name ?? "Applicant"}
                subtitle={selectedSupportTicket.subject ?? "Support ticket"}
                avatar={
                  <ConversationAvatar name={selectedSupportTicket.applicant_name ?? "Applicant"} />
                }
              />
              <SupportConversationClient
                ticketId={selectedSupportTicketId}
                viewerRole="staff"
                counterpartyLabel={selectedSupportTicket.applicant_name ?? "Applicant"}
                compact
                ticketStatus={selectedSupportTicket.status}
              />
            </>
          ) : (
            <div className="flex h-full min-h-[360px] flex-1 items-center justify-center bg-white px-6 text-center">
              {loading || groupsLoading || supportLoading ? (
                <CandidateDetailLoader label="Loading..." className="min-h-0 bg-transparent py-0" />
              ) : (
                <p className="max-w-sm text-sm text-[#64748B]">
                  {activeTab === "group"
                    ? "Pick a group to read and reply."
                    : activeTab === "support"
                      ? "Pick a support ticket to read and reply."
                      : "Pick a chat to read and reply."}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="hidden xl:block">
          {activeTab === "worker" && selectedWorkerId && selectedConversation ? (
            <ApplicantChatProfilePanel
              workerId={selectedWorkerId}
              applicantName={selectedConversation.applicantName}
            />
          ) : activeTab === "group" && selectedGroupId && selectedGroup ? (
            <GroupChatProfilePanel
              groupId={selectedGroupId}
              groupName={selectedGroup.name}
              createdAt={selectedGroup.createdAt}
              memberInitials={selectedGroup.memberInitials}
              onRemoved={() => {
                setSelectedGroupId(null);
                void loadGroups();
              }}
              onMembersChanged={() => {
                void loadGroups();
              }}
            />
          ) : activeTab === "support" && selectedSupportTicket?.applicant_id ? (
            <ApplicantChatProfilePanel
              workerId={selectedSupportTicket.applicant_id}
              applicantName={selectedSupportTicket.applicant_name ?? "Applicant"}
            />
          ) : (
            <aside className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg border border-[#E2E8F0] bg-white px-6 text-center shadow-sm xl:h-full">
              <p className="text-sm text-[#64748B]">
                {activeTab === "group"
                  ? "Select a group to see details."
                  : activeTab === "support"
                    ? "Select a support ticket to see worker details."
                    : "Select a chat to see profile details."}
              </p>
            </aside>
          )}
        </div>
      </div>

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(groupId) => {
          void loadGroups().then((items) => {
            setActiveTab("group");
            setSelectedGroupId(groupId || items[0]?.id || null);
            setSelectedWorkerId(null);
          });
        }}
      />
    </main>
  );
}

function ChatHeader({
  title,
  subtitle,
  avatar,
}: {
  title: string;
  subtitle: string;
  avatar: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#E8EDF2] px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold leading-5 text-[#0F172A]">{title}</h2>
          <p className="text-xs text-[#64748B]">{subtitle}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Call"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
        >
          <Image src={CHAT_PHONE_ICON} alt="" width={20} height={20} className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Video call"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
        >
          <Image src={CHAT_VIDEO_ICON} alt="" width={20} height={20} className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="More options"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-[#F1F5F9]"
        >
          <Image src={CHAT_MORE_ICON} alt="" width={20} height={20} className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ConversationListItem({
  conversation,
  active,
  pinned = false,
  onSelect,
  onTogglePin,
}: {
  conversation: StaffConversation;
  active: boolean;
  pinned?: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={`mb-2 flex h-[55px] w-full items-center gap-2 rounded-md border bg-white px-3 py-3 transition ${
        active ? "border-(--brand-primary)" : "border-[#E2E8F0] hover:border-(--brand-primary)"
      }`}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <div className="shrink-0 scale-90">
          <ConversationAvatar name={conversation.applicantName} photoUrl={conversation.profilePhotoUrl} />
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
      <button
        type="button"
        aria-label={pinned ? "Unpin chat" : "Pin chat"}
        onClick={onTogglePin}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition hover:bg-[#F1F5F9] ${
          pinned ? "text-(--brand-primary)" : "text-[#94A3B8]"
        }`}
      >
        <Pin className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function GroupListItem({
  group,
  active,
  onSelect,
}: {
  group: StaffGroupConversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mb-3 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
        active
          ? "border-(--brand-primary) bg-[#F8FAFC]"
          : "border-[#E5E7EB] bg-white hover:border-(--brand-primary)"
      }`}
    >
      <div className="min-w-0 flex-1">
        <GroupStackedAvatars initials={group.memberInitials} size={30} max={4} />
        <p className="mt-2 text-[12px] font-semibold leading-4 text-[#012352]">{group.name}</p>
        <p className="mt-0.5 truncate text-[10px] leading-[15px] text-[#6B7280]">
          {group.preview || `${group.memberCount} members`}
        </p>
      </div>
    </button>
  );
}

function SupportTicketListItem({
  ticket,
  active,
  onSelect,
}: {
  ticket: SupportTicketConversationItem;
  active: boolean;
  onSelect: () => void;
}) {
  const name = ticket.applicant_name ?? "Applicant";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mb-2 flex w-full flex-col rounded-lg border p-3 text-left transition ${
        active
          ? "border-(--brand-primary) bg-[#F8FAFC]"
          : "border-[#E2E8F0] bg-white hover:border-(--brand-primary)"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="shrink-0 scale-90">
          <ConversationAvatar name={name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[12px] font-semibold text-[#0F172A]">{name}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUPPORT_STATUS_COLORS[ticket.status]}`}
            >
              {ticket.status}
            </span>
          </div>
          <p className="truncate text-[11px] font-medium text-[#334155]">{ticket.subject ?? "Support request"}</p>
          <p className="mt-0.5 truncate text-[10px] text-[#64748B]">{ticket.lastMessagePreview}</p>
          <p className="mt-1 text-[10px] text-[#94A3B8]">{formatChatTime(ticket.lastMessageAt)}</p>
        </div>
      </div>
    </button>
  );
}
