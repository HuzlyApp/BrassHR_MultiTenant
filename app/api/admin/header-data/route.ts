import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { getCachedStaffApiSession, getCachedStaffTenantScope } from "@/lib/auth/cached-staff-auth";
import {
  buildCacheKey,
  CACHE_TTL_SECONDS,
  getOrSetCache,
  invalidateUserCache,
} from "@/lib/cache";
import { invalidateStaffAuthCaches } from "@/lib/auth/invalidate-staff-auth-cache";
import { requireStaffApiSession } from "@/lib/auth/api-session";

type HeaderNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const auth = await getCachedStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const userId = auth.userId;
  const scope = await getCachedStaffTenantScope(auth.authUser);
  const scopeKey = scope.mode === "scoped" ? scope.tenantId : "all";
  const cacheKey = buildCacheKey("admin_header_data", ["user", userId, "tenant", scopeKey], {
    v: 2,
  });
  try {
    const data = await getOrSetCache(
      cacheKey,
      async () => {
        const notificationsRes = await supabase
          .from("notifications")
          .select("id, title, body, type, is_read, sent_at")
          .eq("user_id", userId)
          .order("sent_at", { ascending: false })
          .limit(8);

        if (notificationsRes.error) {
          throw new Error("Failed to fetch header data");
        }

        const unreadCountRes = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false);

        if (unreadCountRes.error) {
          throw new Error("Failed to fetch unread notification count");
        }

        const notifications = (notificationsRes.data ?? []) as HeaderNotification[];

        return {
          userId,
          notifications,
          unreadNotifications: unreadCountRes.count ?? 0,
        };
      },
      CACHE_TTL_SECONDS.userScoped
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
