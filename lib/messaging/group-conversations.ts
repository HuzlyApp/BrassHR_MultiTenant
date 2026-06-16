import { applicantDisplayName, type WorkerSummary } from "@/lib/messaging/staff-conversations";

export type GroupMemberRow = {
  id: string;
  group_id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  joined_at: string;
};

export type GroupMessageRow = {
  id: string;
  group_id: string;
  tenant_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "recruiter" | "worker";
  content: string;
  sent_at: string;
};

export type StaffGroupConversation = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  memberCount: number;
  preview: string;
  sentAt: string | null;
  memberInitials: string[];
  memberNames: string[];
};

export function workerDisplayName(worker: WorkerSummary | undefined, fallback = "Worker"): string {
  return applicantDisplayName(worker) || fallback;
}

export function buildGroupConversation(
  group: { id: string; name: string; created_at: string; created_by: string },
  members: GroupMemberRow[],
  latestMessage?: GroupMessageRow | null
): StaffGroupConversation {
  const memberNames = members.map((member) => member.user_name).filter(Boolean);
  const memberInitials = memberNames.map((name) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  );

  return {
    id: group.id,
    name: group.name,
    createdAt: group.created_at,
    createdBy: group.created_by,
    memberCount: members.length,
    preview: latestMessage?.content?.trim() || "No messages yet",
    sentAt: latestMessage?.sent_at ?? null,
    memberInitials,
    memberNames,
  };
}

export function sortGroupConversations(groups: StaffGroupConversation[]): StaffGroupConversation[] {
  return [...groups].sort((a, b) => {
    if (!a.sentAt) return 1;
    if (!b.sentAt) return -1;
    return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
  });
}

export function relativeChatMinutes(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
