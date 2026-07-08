import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

type WorkerNotification = {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  is_read: boolean | null;
  sent_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.supabase
      .from("notifications")
      .select("id, title, body, type, is_read, sent_at")
      .eq("user_id", auth.user.id)
      .order("sent_at", { ascending: false })
      .limit(8);
    if (error) throw error;

    const { count, error: countError } = await auth.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("is_read", false);
    if (countError) throw countError;

    return NextResponse.json({
      notifications: (data as WorkerNotification[] | null) ?? [],
      unreadNotifications: count ?? 0,
    });
  } catch (err) {
    console.error("[applicant-portal/notifications:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "mark_notifications_read") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", auth.user.id)
      .eq("is_read", false);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[applicant-portal/notifications:patch]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
