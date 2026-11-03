import { NextRequest, NextResponse } from "next/server";
import { requireTeamProductivityAccess, writeAnalyticsAudit } from "@/lib/analytics/access";
import {
  buildTeamProductivityPayload,
  filtersFromSearchParams,
} from "@/lib/analytics/team-productivity-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const payload = await buildTeamProductivityPayload(access.supabase, access.tenantId, filters, {
      viewerUserId: access.authUser.id,
      canViewAllEmployees: access.canViewAllEmployees,
    });

    void writeAnalyticsAudit(access.supabase, {
      tenantId: access.tenantId,
      actorUserId: access.authUser.id,
      action: "view_team_productivity",
      resourceType: "report",
      resourceId: "team-productivity",
      metadata: { filters },
    }).catch(() => undefined);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[admin/reports/team-productivity:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
