import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import {
  groupApplicantMessagesIntoConversations,
  type ApplicantMessageListRow,
  type WorkerSummary,
} from "@/lib/messaging/staff-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  try {
    const scope = await resolveStaffTenantScope(auth.authUser);

    let messagesQuery = supabase
      .from("applicant_messages")
      .select("id, worker_id, tenant_id, sender_role, body, created_at, message_type, attachment_name")
      .order("created_at", { ascending: false })
      .limit(200);

    if (scope.mode === "scoped") {
      messagesQuery = messagesQuery.eq("tenant_id", scope.tenantId);
    }

    const messagesRes = await messagesQuery;
    if (messagesRes.error) throw messagesRes.error;

    const messages = (messagesRes.data ?? []) as ApplicantMessageListRow[];
    const workerIds = Array.from(new Set(messages.map((msg) => msg.worker_id).filter(Boolean)));

    const workerProfiles = workerIds.length
      ? await supabase.from("worker").select("id, first_name, last_name, email").in("id", workerIds)
      : { data: [], error: null };
    if (workerProfiles.error) throw workerProfiles.error;

    const workerMap = new Map(
      (workerProfiles.data ?? []).map((worker) => [worker.id, worker as WorkerSummary])
    );
    const conversations = groupApplicantMessagesIntoConversations(messages, workerMap);

    return NextResponse.json({
      conversations,
      tenantId: scope.mode === "scoped" ? scope.tenantId : null,
      unreadMessages: conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    });
  } catch (error) {
    console.error("[admin/messages/conversations:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
