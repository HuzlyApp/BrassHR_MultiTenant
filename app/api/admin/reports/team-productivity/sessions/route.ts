import { NextRequest, NextResponse } from "next/server";
import { requireTeamProductivityAccess } from "@/lib/analytics/access";
import { endAnalyticsSession, upsertSessionHeartbeat } from "@/lib/analytics/sessions";

export const runtime = "nodejs";

/**
 * POST heartbeat / session start.
 * Body: { clientSessionKey, meaningful?, module?, visibilityState?, end?: boolean, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    const body = (await req.json().catch(() => ({}))) as {
      clientSessionKey?: string;
      meaningful?: boolean;
      module?: string;
      visibilityState?: string;
      end?: boolean;
      reason?: "logout" | "idle_timeout" | "token_expired" | "manual" | "system";
      departmentId?: string | null;
      role?: string | null;
    };

    const clientSessionKey = String(body.clientSessionKey ?? "").trim();
    if (!clientSessionKey) {
      return NextResponse.json({ error: "clientSessionKey is required" }, { status: 400 });
    }

    if (body.end) {
      await endAnalyticsSession(access.supabase, {
        tenantId: access.tenantId,
        userId: access.authUser.id,
        clientSessionKey,
        reason: body.reason ?? "logout",
      });
      return NextResponse.json({ ok: true, ended: true });
    }

    const result = await upsertSessionHeartbeat(access.supabase, {
      tenantId: access.tenantId,
      userId: access.authUser.id,
      clientSessionKey,
      departmentId: body.departmentId ?? null,
      role: body.role ?? access.role,
      module: body.module ?? "admin_recruiter",
      userAgent: req.headers.get("user-agent"),
      meaningful: Boolean(body.meaningful),
      visibilityState: body.visibilityState ?? null,
    });

    return NextResponse.json({
      ok: true,
      sessionId: result.sessionId,
      engagedSeconds: result.engagedSeconds,
      idleSeconds: result.idleSeconds,
      disclosure:
        "Engaged session time measures interaction with this application, not all work performed by the employee.",
    });
  } catch (err) {
    console.error("[admin/reports/team-productivity/sessions:post]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    // Table may not exist yet before migration — fail soft for heartbeats.
    if (/relation .* does not exist/i.test(message) || /Could not find the table/i.test(message)) {
      return NextResponse.json({ ok: false, skipped: true, error: message }, { status: 200 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
