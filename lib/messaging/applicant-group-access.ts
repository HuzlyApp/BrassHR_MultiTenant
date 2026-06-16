import type { SupabaseClient } from "@supabase/supabase-js";
import { applicantDisplayName } from "@/lib/applicant-portal";
import type { GroupMemberRow } from "@/lib/messaging/group-conversations";

export type ApplicantAssignedGroup = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  members: { id: string; name: string }[];
  preview: string;
  sentAt: string | null;
};

export async function assertApplicantAssignedToGroup(
  supabase: SupabaseClient,
  groupId: string,
  workerId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", workerId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export async function loadApplicantAssignedGroups(
  supabase: SupabaseClient,
  workerId: string
): Promise<ApplicantAssignedGroup[]> {
  const membershipsRes = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", workerId);
  if (membershipsRes.error) throw membershipsRes.error;

  const groupIds = Array.from(
    new Set((membershipsRes.data ?? []).map((row) => String(row.group_id)).filter(Boolean))
  );
  if (groupIds.length === 0) return [];

  const [groupsRes, membersRes, messagesRes] = await Promise.all([
    supabase.from("groups").select("id, name, created_at").in("id", groupIds).order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select("id, group_id, user_id, user_name")
      .in("group_id", groupIds)
      .order("joined_at", { ascending: true }),
    supabase
      .from("group_messages")
      .select("group_id, content, sent_at")
      .in("group_id", groupIds)
      .order("sent_at", { ascending: false }),
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (messagesRes.error) throw messagesRes.error;

  const membersByGroup = new Map<string, GroupMemberRow[]>();
  for (const member of (membersRes.data ?? []) as GroupMemberRow[]) {
    const list = membersByGroup.get(member.group_id) ?? [];
    list.push(member);
    membersByGroup.set(member.group_id, list);
  }

  const latestByGroup = new Map<string, { content: string; sent_at: string }>();
  for (const message of messagesRes.data ?? []) {
    const gid = String(message.group_id);
    if (!latestByGroup.has(gid)) {
      latestByGroup.set(gid, {
        content: String(message.content ?? ""),
        sent_at: String(message.sent_at),
      });
    }
  }

  return (groupsRes.data ?? []).map((group) => {
    const members = membersByGroup.get(group.id) ?? [];
    const latest = latestByGroup.get(group.id);
    return {
      id: group.id,
      name: group.name,
      createdAt: group.created_at,
      memberCount: members.length,
      members: members.map((member) => ({
        id: member.user_id,
        name: member.user_name || "Member",
      })),
      preview: latest?.content?.trim() || "No messages yet",
      sentAt: latest?.sent_at ?? null,
    };
  });
}

export function applicantSenderName(
  applicant: { first_name: string | null; last_name: string | null; email: string | null; id: string; tenant_id: string; user_id: string | null; status: string | null; applicant_password_set_at: string | null }
): string {
  return applicantDisplayName(applicant);
}
