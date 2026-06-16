import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import type { GroupMessageRow } from "@/lib/messaging/group-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadGroupContext(groupId: string) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return { error: auth };

  const supabase = getServiceClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 }) };
  }

  const scope = await resolveStaffTenantScope(auth.authUser);
  const groupRes = await supabase
    .from("groups")
    .select("id, tenant_id, name")
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

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupContext(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const messagesRes = await resolved.supabase
      .from("group_messages")
      .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
      .eq("group_id", resolved.group.id)
      .order("sent_at", { ascending: true });
    if (messagesRes.error) throw messagesRes.error;

    return NextResponse.json({ messages: (messagesRes.data ?? []) as GroupMessageRow[] });
  } catch (error) {
    console.error("[admin/messages/groups/:id/messages:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadGroupContext(idCheck.value);
    if ("error" in resolved) return resolved.error;

    const body = (await req.json().catch(() => ({}))) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const senderId = resolved.auth.devBypass ? "dev-bypass" : resolved.auth.userId;
    const senderName =
      resolved.auth.authUser.user_metadata?.full_name?.trim() ||
      resolved.auth.authUser.email?.split("@")[0] ||
      "Recruiter";

    const insertRes = await resolved.supabase
      .from("group_messages")
      .insert({
        tenant_id: resolved.group.tenant_id,
        group_id: resolved.group.id,
        sender_id: senderId,
        sender_name: senderName,
        sender_role: "recruiter",
        content,
      })
      .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
      .single();
    if (insertRes.error) throw insertRes.error;

    return NextResponse.json({ ok: true, message: insertRes.data as GroupMessageRow });
  } catch (error) {
    console.error("[admin/messages/groups/:id/messages:post]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
