import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  ApplicationStatusError,
  listApplicationStatusHistory,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** GET /api/admin/job-applications/[id]/status-history */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const { id } = await context.params;
    const applicationId = id?.trim();
    if (!applicationId) {
      return NextResponse.json({ error: "Application id is required" }, { status: 400 });
    }

    const history = await listApplicationStatusHistory(supabase, {
      tenantId,
      applicationId,
    });

    return NextResponse.json({
      history: history.map((entry) => ({
        id: entry.id,
        fromStatus: {
          id: entry.fromStatusId,
          name: entry.fromStatusName,
        },
        toStatus: {
          id: entry.toStatusId,
          name: entry.toStatusName,
        },
        note: entry.note,
        changedBy: {
          id: entry.changedByUserId,
          name: entry.changedByName,
        },
        changedAt: entry.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof ApplicationStatusError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[job-applications/:id/status-history]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load status history" },
      { status: 500 }
    );
  }
}
