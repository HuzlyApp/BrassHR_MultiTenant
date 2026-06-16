import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import {
  applicantSenderName,
  assertApplicantAssignedToGroup,
} from "@/lib/messaging/applicant-group-access";
import type { GroupMessageRow } from "@/lib/messaging/group-conversations";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ groupId: string }> };

async function loadAssignedGroup(auth: Awaited<ReturnType<typeof requireApprovedApplicant>>, groupId: string) {
  if (auth instanceof NextResponse) return { error: auth };

  const assigned = await assertApplicantAssignedToGroup(auth.supabase, groupId, auth.applicant.id);
  if (!assigned) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const groupRes = await auth.supabase
    .from("groups")
    .select("id, tenant_id, name, created_at")
    .eq("id", groupId)
    .maybeSingle();
  if (groupRes.error) throw groupRes.error;
  if (!groupRes.data) {
    return { error: NextResponse.json({ error: "Group not found" }, { status: 404 }) };
  }

  return { auth, group: groupRes.data };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadAssignedGroup(auth, idCheck.value);
    if ("error" in resolved) return resolved.error;

    const messagesRes = await resolved.auth.supabase
      .from("group_messages")
      .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
      .eq("group_id", resolved.group.id)
      .order("sent_at", { ascending: true });
    if (messagesRes.error) throw messagesRes.error;

    const membersRes = await resolved.auth.supabase
      .from("group_members")
      .select("id, user_id, user_name, joined_at")
      .eq("group_id", resolved.group.id)
      .order("joined_at", { ascending: true });
    if (membersRes.error) throw membersRes.error;

    return NextResponse.json({
      group: {
        id: resolved.group.id,
        name: resolved.group.name,
        createdAt: resolved.group.created_at,
        members: (membersRes.data ?? []).map((member) => ({
          id: member.user_id,
          name: member.user_name || "Member",
          joinedAt: member.joined_at,
        })),
      },
      messages: (messagesRes.data ?? []) as GroupMessageRow[],
    });
  } catch (err) {
    console.error("[applicant-portal/groups/:id/messages:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const { groupId: groupIdRaw } = await context.params;
    const idCheck = parseRequiredUuid(groupIdRaw, "groupId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const resolved = await loadAssignedGroup(auth, idCheck.value);
    if ("error" in resolved) return resolved.error;

    const body = (await req.json().catch(() => ({}))) as { content?: string };
    const content = body.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    const insertRes = await resolved.auth.supabase
      .from("group_messages")
      .insert({
        tenant_id: resolved.group.tenant_id,
        group_id: resolved.group.id,
        sender_id: auth.applicant.id,
        sender_name: applicantSenderName(auth.applicant),
        sender_role: "worker",
        content,
      })
      .select("id, group_id, tenant_id, sender_id, sender_name, sender_role, content, sent_at")
      .single();
    if (insertRes.error) throw insertRes.error;

    return NextResponse.json({ ok: true, message: insertRes.data as GroupMessageRow });
  } catch (err) {
    console.error("[applicant-portal/groups/:id/messages:post]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send message" },
      { status: 500 }
    );
  }
}
