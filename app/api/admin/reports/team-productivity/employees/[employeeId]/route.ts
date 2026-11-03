import { NextRequest, NextResponse } from "next/server";
import { requireTeamProductivityAccess, writeAnalyticsAudit } from "@/lib/analytics/access";
import {
  buildEmployeeDetailPayload,
  filtersFromSearchParams,
} from "@/lib/analytics/team-productivity-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ employeeId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const access = await requireTeamProductivityAccess();
    if (access instanceof NextResponse) return access;

    const { employeeId } = await context.params;
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }

    if (!access.canViewAllEmployees && employeeId !== access.authUser.id) {
      return NextResponse.json({ error: "You can only view your own productivity metrics." }, { status: 403 });
    }

    const filters = filtersFromSearchParams(req.nextUrl.searchParams);
    const payload = await buildEmployeeDetailPayload(
      access.supabase,
      access.tenantId,
      employeeId,
      filters,
    );

    if (!payload.employee) {
      return NextResponse.json({ error: "Employee not found in scope." }, { status: 404 });
    }

    void writeAnalyticsAudit(access.supabase, {
      tenantId: access.tenantId,
      actorUserId: access.authUser.id,
      action: "view_employee_productivity",
      resourceType: "employee",
      resourceId: employeeId,
      metadata: { filters },
    }).catch(() => undefined);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[admin/reports/team-productivity/employees:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
