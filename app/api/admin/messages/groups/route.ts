import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import {
  buildGroupConversation,
  sortGroupConversations,
  workerDisplayName,
  type GroupMemberRow,
  type GroupMessageRow,
} from "@/lib/messaging/group-conversations";
import { type WorkerSummary } from "@/lib/messaging/staff-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function resolveTenantId(authUser: Parameters<typeof resolveStaffTenantScope>[0]) {
  const scope = await resolveStaffTenantScope(authUser);
  if (scope.mode === "scoped") return scope.tenantId;
  return null;
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveTenantId(auth.authUser);
    if (!tenantId) {
      return NextResponse.json({ error: "Select a tenant to view group chats." }, { status: 400 });
    }

    const groupsRes = await supabase
      .from("groups")
      .select("id, name, created_at, created_by")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (groupsRes.error) throw groupsRes.error;

    const groups = groupsRes.data ?? [];
    if (groups.length === 0) {
      return NextResponse.json({ groups: [], tenantId });
    }

    const groupIds = groups.map((group) => group.id);
    const [membersRes, messagesRes] = await Promise.all([
      supabase
        .from("group_members")
        .select("id, group_id, tenant_id, user_id, user_name, joined_at")
        .in("group_id", groupIds),
      supabase
        .from("group_messages")
        .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
        .in("group_id", groupIds)
        .order("sent_at", { ascending: false }),
    ]);
    if (membersRes.error) throw membersRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const membersByGroup = new Map<string, GroupMemberRow[]>();
    for (const member of (membersRes.data ?? []) as GroupMemberRow[]) {
      const list = membersByGroup.get(member.group_id) ?? [];
      list.push(member);
      membersByGroup.set(member.group_id, list);
    }

    const latestByGroup = new Map<string, GroupMessageRow>();
    for (const message of (messagesRes.data ?? []) as GroupMessageRow[]) {
      if (!latestByGroup.has(message.group_id)) {
        latestByGroup.set(message.group_id, message);
      }
    }

    const conversations = sortGroupConversations(
      groups.map((group) =>
        buildGroupConversation(
          group,
          membersByGroup.get(group.id) ?? [],
          latestByGroup.get(group.id) ?? null
        )
      )
    );

    return NextResponse.json({ groups: conversations, tenantId });
  } catch (error) {
    console.error("[admin/messages/groups:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch groups" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  try {
    const tenantId = await resolveTenantId(auth.authUser);
    if (!tenantId) {
      return NextResponse.json({ error: "Select a tenant to create a group." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      workerIds?: string[];
    };
    const name = body.name?.trim() ?? "";
    const workerIds = Array.from(new Set((body.workerIds ?? []).map((id) => id.trim()).filter(Boolean)));

    if (!name) {
      return NextResponse.json({ error: "Group name is required." }, { status: 400 });
    }
    if (workerIds.length === 0) {
      return NextResponse.json({ error: "Add at least one worker to the group." }, { status: 400 });
    }

    const workersRes = await supabase
      .from("worker")
      .select("id, first_name, last_name, email")
      .eq("tenant_id", tenantId)
      .in("id", workerIds);
    if (workersRes.error) throw workersRes.error;

    const workers = (workersRes.data ?? []) as WorkerSummary[];
    if (workers.length !== workerIds.length) {
      return NextResponse.json({ error: "One or more workers were not found for this tenant." }, { status: 400 });
    }

    const createdBy = auth.devBypass ? "dev-bypass" : auth.userId;
    const groupRes = await supabase
      .from("groups")
      .insert({
        tenant_id: tenantId,
        name,
        created_by: createdBy,
      })
      .select("id, name, created_at, created_by")
      .single();
    if (groupRes.error) throw groupRes.error;

    const memberRows = workers.map((worker) => ({
      tenant_id: tenantId,
      group_id: groupRes.data.id,
      user_id: worker.id,
      user_name: workerDisplayName(worker),
    }));

    const membersRes = await supabase
      .from("group_members")
      .insert(memberRows)
      .select("id, group_id, tenant_id, user_id, user_name, joined_at");
    if (membersRes.error) throw membersRes.error;

    const conversation = buildGroupConversation(groupRes.data, (membersRes.data ?? []) as GroupMemberRow[]);
    return NextResponse.json({ ok: true, group: conversation });
  } catch (error) {
    console.error("[admin/messages/groups:post]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create group" },
      { status: 500 }
    );
  }
}
