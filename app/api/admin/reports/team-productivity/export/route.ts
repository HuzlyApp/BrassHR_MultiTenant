import { NextRequest, NextResponse } from "next/server";
import { requireTeamProductivityAccess, writeAnalyticsAudit } from "@/lib/analytics/access";
import {
  buildTeamProductivityPayload,
  employeesToCsv,
  filtersFromSearchParams,
} from "@/lib/analytics/team-productivity-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    if (!access.canExport) {
      return NextResponse.json({ error: "Export is not permitted for your role." }, { status: 403 });
    }

    const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
    if (format !== "csv") {
      return NextResponse.json(
        { error: "Only CSV export is implemented in this vertical slice. Excel/PDF remain pending." },
        { status: 400 },
      );
    }

    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const payload = await buildTeamProductivityPayload(access.supabase, access.tenantId, filters, {
      viewerUserId: access.authUser.id,
      canViewAllEmployees: access.canViewAllEmployees,
    });

    const header = [
      `# Team Productivity KPI export`,
      `# Period: ${payload.period.label} (${payload.period.start} – ${payload.period.end})`,
      `# Generated: ${payload.generatedAt}`,
      `# Data freshness: ${payload.dataFreshness.lastActivityAt ?? "n/a"}`,
      `# Disclosure: ${payload.disclosure}`,
      `# Note: Missing metrics are exported as N/A (not zero).`,
      ``,
    ].join("\n");

    const csv = header + employeesToCsv(payload.employees);

    await access.supabase.from("analytics_report_export_jobs").insert({
      tenant_id: access.tenantId,
      requested_by_user_id: access.authUser.id,
      report_key: "team-productivity",
      format: "csv",
      filters,
      status: "completed",
      row_count: payload.employees.length,
      completed_at: new Date().toISOString(),
    });

    void writeAnalyticsAudit(access.supabase, {
      tenantId: access.tenantId,
      actorUserId: access.authUser.id,
      action: "export_team_productivity",
      resourceType: "report",
      resourceId: "team-productivity",
      metadata: { format: "csv", rowCount: payload.employees.length, filters },
    }).catch(() => undefined);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="team-productivity-${payload.period.preset}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/reports/team-productivity/export:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
