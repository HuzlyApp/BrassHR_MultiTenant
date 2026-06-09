import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import {
  buildCacheKey,
  CACHE_TTL_SECONDS,
  getOrSetCache,
  invalidateUserCache,
} from "@/lib/cache";

type HeaderProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  profile_photo: string | null;
  email: string | null;
};

type HeaderNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

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

  const userId = auth.userId;
  const cacheKey = buildCacheKey("admin_header_data", ["user", userId], { limit: 40 });
  try {
    const data = await getOrSetCache(
      cacheKey,
      async () => {
        const scope = await resolveStaffTenantScope(auth.authUser);

        const [profileRes, notificationsRes] = await Promise.all([
          supabase
            .from("users")
            .select("id, first_name, last_name, role, profile_photo, email")
            .eq("id", userId)
            .maybeSingle<HeaderProfile>(),
          supabase
            .from("notifications")
            .select("id, title, body, type, is_read, sent_at")
            .eq("user_id", userId)
            .order("sent_at", { ascending: false })
            .limit(8),
        ]);

        if (profileRes.error || notificationsRes.error) {
          throw new Error("Failed to fetch header data");
        }

        let messagesQuery = supabase
          .from("applicant_messages")
          .select("id, worker_id, tenant_id, sender_role, body, created_at")
          .order("created_at", { ascending: false })
          .limit(80);

        if (scope.mode === "scoped") {
          messagesQuery = messagesQuery.eq("tenant_id", scope.tenantId);
        }

        const messagesRes = await messagesQuery;
        if (messagesRes.error) {
          throw new Error("Failed to fetch applicant messages");
        }

        const notifications = (notificationsRes.data ?? []) as HeaderNotification[];
        const messages = (messagesRes.data ?? []) as ApplicantMessageListRow[];
        const workerIds = Array.from(new Set(messages.map((msg) => msg.worker_id).filter(Boolean)));

        const workerProfiles = workerIds.length
          ? await supabase
              .from("worker")
              .select("id, first_name, last_name, email")
              .in("id", workerIds)
          : { data: [], error: null };
        if (workerProfiles.error) {
          throw new Error("Failed to fetch conversation applicants");
        }

        const workerMap = new Map((workerProfiles.data ?? []).map((worker) => [worker.id, worker as WorkerSummary]));
        const conversations = groupApplicantMessagesIntoConversations(messages, workerMap);

        return {
          userId,
          profile: profileRes.data ?? null,
          notifications,
          conversations,
          unreadNotifications: notifications.filter((n) => !n.is_read).length,
          unreadMessages: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
        };
      },
      CACHE_TTL_SECONDS.searchResults
    );

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch header data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "mark_notifications_read") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", auth.userId)
    .eq("is_read", false);

  if (error) {
    return NextResponse.json({ error: "Failed to update notifications", details: error }, { status: 500 });
  }

  await invalidateUserCache("admin_header_data", auth.userId);
  await invalidateUserCache("notifications", auth.userId);

  return NextResponse.json({ ok: true });
}
