import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import {
  buildGroupConversation,
  type GroupMemberRow,
  type GroupMessageRow,
} from "@/lib/messaging/group-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadGroupForStaff(groupId: string) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = getServiceClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }) };
  }

  const scope = await resolveStaffTenantScope(auth.authUser);
  const groupRes = await supabase
    .from("groups")
    .select("id, tenant_id, name, created_at, created_by")
    .eq("id", groupId)
    .maybeSingle();
  if (groupRes.error) throw groupRes.error;
  if (!groupRes.data) {
    return { error: NextResponse.json({ error: "Group not found" }, { status: 404 }) };
  }
  if (scope.mode === "scoped" && scope.tenantId !== groupRes.data.tenant_id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { auth, supabase, group: groupRes.data };
}

type RouteContext = { params: Promise<{ groupId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupForStaff(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const [membersRes, messagesRes] = await Promise.all([
      resolved.supabase
        .from("group_members")
        .select("id, group_id, tenant_id, user_id, user_name, joined_at")
        .eq("group_id", resolved.group.id)
        .order("joined_at", { ascending: true }),
      resolved.supabase
        .from("group_messages")
        .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
        .eq("group_id", resolved.group.id)
        .order("sent_at", { ascending: false })
        .limit(1),
    ]);
    if (membersRes.error) throw membersRes.error;
    if (messagesRes.error) throw messagesRes.error;

    const group = buildGroupConversation(
      resolved.group,
      (membersRes.data ?? []) as GroupMemberRow[],
      ((messagesRes.data ?? [])[0] as GroupMessageRow | undefined) ?? null
    );

    return NextResponse.json({ group });
  } catch (error) {
    console.error("[admin/messages/groups/:id:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch group" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupForStaff(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const { error } = await resolved.supabase.from("groups").delete().eq("id", resolved.group.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/messages/groups/:id:delete]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete group" },
      { status: 500 }
    );
  }
}
