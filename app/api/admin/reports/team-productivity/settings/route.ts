import { NextRequest, NextResponse } from "next/server";
import { requireTeamProductivityAccess, writeAnalyticsAudit } from "@/lib/analytics/access";
import { DEFAULT_IDLE_THRESHOLD_SECONDS } from "@/lib/analytics/sessions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    const { data, error } = await access.supabase
      .from("analytics_tenant_settings")
      .select(
        "tenant_id, idle_threshold_seconds, engagement_disclosure, allow_manual_work_entries, weight_redistribution_policy, updated_at",
      )
      .eq("tenant_id", access.tenantId)
      .maybeSingle();

    if (error && !/does not exist/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      settings: data ?? {
        tenant_id: access.tenantId,
        idle_threshold_seconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
        engagement_disclosure:
          "Engaged session time measures interaction with this application, not all work performed by the employee.",
        allow_manual_work_entries: true,
        weight_redistribution_policy: "proportional",
        updated_at: null,
      },
      canConfigure: access.canConfigureKpis,
      note: "Scores must not be used automatically for employment decisions, discipline, or compensation.",
    });
  } catch (err) {
    console.error("[admin/reports/team-productivity/settings:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    if (!access.canConfigureKpis) {
      return NextResponse.json({ error: "Only administrators can change KPI settings." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      idleThresholdSeconds?: number;
      engagementDisclosure?: string;
      allowManualWorkEntries?: boolean;
      weightRedistributionPolicy?: "proportional" | "keep_gap" | "exclude_score";
    };

    const idle =
      typeof body.idleThresholdSeconds === "number"
        ? Math.min(86400, Math.max(60, Math.floor(body.idleThresholdSeconds)))
        : DEFAULT_IDLE_THRESHOLD_SECONDS;

    const row = {
      tenant_id: access.tenantId,
      idle_threshold_seconds: idle,
      engagement_disclosure:
        body.engagementDisclosure?.trim() ||
        "Engaged session time measures interaction with this application, not all work performed by the employee.",
      allow_manual_work_entries: body.allowManualWorkEntries ?? true,
      weight_redistribution_policy: body.weightRedistributionPolicy ?? "proportional",
      updated_by_user_id: access.authUser.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await access.supabase
      .from("analytics_tenant_settings")
      .upsert(row, { onConflict: "tenant_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void writeAnalyticsAudit(access.supabase, {
      tenantId: access.tenantId,
      actorUserId: access.authUser.id,
      action: "update_kpi_settings",
      resourceType: "analytics_tenant_settings",
      resourceId: access.tenantId,
      metadata: row,
    }).catch(() => undefined);

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("[admin/reports/team-productivity/settings:patch]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
