"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Users } from "lucide-react";
import GroupStackedAvatars, {
  SingleChatAvatar,
} from "@/app/admin_recruiter/messages/GroupStackedAvatars";
import { nameInitials } from "@/app/admin_recruiter/messages/chat-ui";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { useApplicantPortal } from "@/app/application/components/applicant-portal/ApplicantPortalProvider";
import {
  ApplicantGroupConversation,
} from "@/app/application/components/applicant-portal/ApplicantGroupChatTab";
import { ApplicantRecruiterChatConversation } from "@/app/application/components/applicant-portal/ApplicantRecruiterChatConversation";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "@/app/application/components/applicant-portal/worker-schedule-typography";

type ChatTab = "recruiter" | "group";

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

function parseTab(value: string | null): ChatTab {
  return value === "group" ? "group" : "recruiter";
}

function ChatTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
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
    </button>
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
    </div>
  );
}

export function ApplicantChatClient() {
  return (
    <Suspense fallback={null}>
      <ApplicantChatClientContent />
    </Suspense>
  );
}

function ApplicantChatClientContent() {
  const searchParams = useSearchParams();
  const branding = useTenantBranding();
  const { session, sessionReady, authHeaders, messaging } = useApplicantPortal();
  const [activeTab, setActiveTab] = useState<ChatTab>(() => parseTab(searchParams.get("tab")));
  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const recruiterName = branding.companyName?.trim() || "Your Recruiter";
  const workerName = session?.applicant.name?.trim() || "Worker";
  const applicantWorkerId = session?.applicant.id ?? null;

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (!sessionReady || !applicantWorkerId) return;

    let alive = true;
    setGroupsLoading(true);
    setGroupsError(null);

    void (async () => {
      try {
        const headers = await authHeaders();
        if (!headers) return;
        const res = await fetch("/api/applicant-portal/groups", { headers, cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as {
          groups?: AssignedGroup[];
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error || "Could not load group chats.");
        if (!alive) return;
        const items = payload.groups ?? [];
        setGroups(items);
        setSelectedGroupId((current) => current ?? items[0]?.id ?? null);
      } catch (err) {
        if (alive) setGroupsError(err instanceof Error ? err.message : "Could not load group chats.");
      } finally {
        if (alive) setGroupsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [applicantWorkerId, authHeaders, sessionReady]);

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
    }
  }, [groups, selectedGroupId]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.preview.toLowerCase().includes(query) ||
        group.members.some((member) => member.name.toLowerCase().includes(query))
    );
  }, [groups, searchQuery]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const lastMessagePreview =
    messaging.messages.length > 0
      ? messaging.messages[messaging.messages.length - 1]?.body?.trim() || "Attachment"
      : "Chat with your recruiter";

  return (
    <div className={WORKER_PORTAL_PAGE_PAD_CLASS}>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#0F172A]">Messages</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Chat with your recruiter or your team groups.
        </p>
      </div>

      {groupsError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {groupsError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:h-[calc(100vh-220px)] lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] lg:gap-3 lg:items-stretch">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm lg:h-full">
          <div className="border-b border-[#E8EDF2] p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-[10px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                className="h-8 w-full rounded-[8px] border border-[#D8E0EA] bg-[#F8FAFC] py-2 pl-9 pr-[10px] text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-(--brand-primary)"
              />
            </div>
            <div className="mt-4 flex items-center gap-6 px-1">
              <ChatTabButton
                label="Recruiter"
                active={activeTab === "recruiter"}
                onClick={() => setActiveTab("recruiter")}
              />
              <ChatTabButton
                label="Group"
                active={activeTab === "group"}
                onClick={() => setActiveTab("group")}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "recruiter" ? (
              <div className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("recruiter")}
                  className="mb-2 flex h-[55px] w-full items-center gap-2 rounded-md border border-(--brand-primary) bg-white px-3 py-3 text-left transition"
                >
                  <div className="shrink-0 scale-90">
                    <SingleChatAvatar name={recruiterName} size={40} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold leading-4 text-[#0F172A]">
                      {recruiterName}
                    </p>
                    <p className="truncate text-[10px] font-normal leading-[15px] text-[#64748B]">
                      {lastMessagePreview}
                    </p>
                  </div>
                </button>
              </div>
            ) : null}

            {activeTab === "group" ? (
              <>
                {!groupsLoading && filteredGroups.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#64748B]">
                    {searchQuery.trim()
                      ? "No groups match your search."
                      : "No group chat assigned yet."}
                  </p>
                ) : null}
                {!groupsLoading && filteredGroups.length > 0 ? (
                  <div className="px-3 py-3">
                    <p className="mb-2 px-1 text-[12px] font-semibold text-[#0F172A]">Your groups</p>
                    {filteredGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`mb-3 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                          group.id === selectedGroupId
                            ? "border-(--brand-primary) bg-[#F8FAFC]"
                            : "border-[#E5E7EB] bg-white hover:border-(--brand-primary)"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <GroupStackedAvatars
                            initials={group.members.map((member) => nameInitials(member.name))}
                            size={30}
                            max={4}
                          />
                          <p className="mt-2 text-[12px] font-semibold leading-4 text-[#012352]">
                            {group.name}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] leading-[15px] text-[#6B7280]">
                            {group.preview || `${group.memberCount} members`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-lg border border-[#E2E8F0] bg-white shadow-sm lg:h-full">
          {activeTab === "recruiter" ? (
            <>
              <ChatHeader
                title={recruiterName}
                subtitle="Recruiter chat"
                avatar={<SingleChatAvatar name={recruiterName} size={40} />}
              />
              <ApplicantRecruiterChatConversation
                messaging={messaging}
                recruiterName={recruiterName}
                workerName={workerName}
              />
            </>
          ) : selectedGroup && applicantWorkerId ? (
            <>
              <ChatHeader
                title={selectedGroup.name}
                subtitle={`${selectedGroup.memberCount} members`}
                avatar={
                  <GroupStackedAvatars
                    initials={selectedGroup.members.map((member) => nameInitials(member.name))}
                    size={30}
                    max={3}
                  />
                }
              />
              <ApplicantGroupConversation
                groupId={selectedGroup.id}
                groupName={selectedGroup.name}
                members={
                  members.length > 0
                    ? members
                    : selectedGroup.members.map((member) => ({ ...member, joinedAt: "" }))
                }
                applicantWorkerId={applicantWorkerId}
                workerName={workerName}
              />
            </>
          ) : (
            <div className="flex h-full min-h-[360px] flex-1 flex-col items-center justify-center px-6 text-center">
              {!groupsLoading && groups.length === 0 ? (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B]">
                    <Users className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    No group chat has been assigned yet.
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-[#64748B]">
                    When your recruiter adds you to a group, it will appear in the Group tab.
                  </p>
                </>
              ) : !groupsLoading ? (
                <p className="max-w-sm text-sm text-[#64748B]">Pick a group to read and reply.</p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
