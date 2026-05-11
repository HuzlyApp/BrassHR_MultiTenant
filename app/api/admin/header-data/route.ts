import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireApiSession } from "@/lib/auth/api-session";

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

type RawMessage = {
  id: string;
  sender_id: string | null;
  receiver_id: string | null;
  content: string | null;
  is_read: boolean | null;
  sent_at: string | null;
  shift_id: string | null;
};

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const userId = auth.userId;
  const [profileRes, notificationsRes, messagesRes] = await Promise.all([
    supabase.from("users").select("id, first_name, last_name, role, profile_photo, email").eq("id", userId).maybeSingle<HeaderProfile>(),
    supabase.from("notifications").select("id, title, body, type, is_read, sent_at").eq("user_id", userId).order("sent_at", { ascending: false }).limit(8),
    supabase.from("messages").select("id, sender_id, receiver_id, content, is_read, sent_at, shift_id").or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order("sent_at", { ascending: false }).limit(40),
  ]);

  if (profileRes.error || notificationsRes.error || messagesRes.error) {
    return NextResponse.json(
      {
        error: "Failed to fetch header data",
        details: [profileRes.error, notificationsRes.error, messagesRes.error].filter(Boolean),
      },
      { status: 500 }
    );
  }

  const notifications = (notificationsRes.data ?? []) as HeaderNotification[];
  const messages = (messagesRes.data ?? []) as RawMessage[];
  const counterpartIds = Array.from(
    new Set(
      messages
        .map((msg) => (msg.sender_id === userId ? msg.receiver_id : msg.sender_id))
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );

  const counterpartProfiles = counterpartIds.length
    ? await supabase.from("users").select("id, first_name, last_name, role, profile_photo, email").in("id", counterpartIds)
    : { data: [], error: null };
  if (counterpartProfiles.error) {
    return NextResponse.json({ error: "Failed to fetch conversation users", details: counterpartProfiles.error }, { status: 500 });
  }

  const counterpartMap = new Map((counterpartProfiles.data ?? []).map((p) => [p.id, p as HeaderProfile]));
  const grouped = new Map<string, { id: string; counterpartId: string; counterpartName: string; preview: string; sentAt: string | null; unreadCount: number; href: string }>();
  for (const msg of messages) {
    const counterpartId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    if (!counterpartId) continue;
    const counterpart = counterpartMap.get(counterpartId);
    const counterpartName =
      [counterpart?.first_name, counterpart?.last_name].filter(Boolean).join(" ").trim() ||
      counterpart?.email ||
      "Unknown user";
    const isUnread = msg.receiver_id === userId && !msg.is_read;
    const href = msg.shift_id
      ? `/admin_recruiter/messages/${counterpartId}?shift=${encodeURIComponent(msg.shift_id)}`
      : `/admin_recruiter/messages/${counterpartId}`;
    const existing = grouped.get(counterpartId);
    if (!existing) {
      grouped.set(counterpartId, {
        id: msg.id,
        counterpartId,
        counterpartName,
        preview: msg.content ?? "(no content)",
        sentAt: msg.sent_at,
        unreadCount: isUnread ? 1 : 0,
        href,
      });
      continue;
    }
    existing.unreadCount += isUnread ? 1 : 0;
  }

  const conversations = Array.from(grouped.values()).sort((a, b) => {
    if (!a.sentAt) return 1;
    if (!b.sentAt) return -1;
    return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
  });

  return NextResponse.json({
    userId,
    profile: profileRes.data ?? null,
    notifications,
    conversations,
    unreadNotifications: notifications.filter((n) => !n.is_read).length,
    unreadMessages: conversations.reduce((sum, c) => sum + c.unreadCount, 0),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiSession();
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

  return NextResponse.json({ ok: true });
}
