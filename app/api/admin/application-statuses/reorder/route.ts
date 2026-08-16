import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import {
  ApplicationStatusError,
  reorderApplicationStatuses,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** PATCH — reorder statuses (admin only). Body: { orderedIds: string[] } */
export async function PATCH(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { orderedIds?: unknown } | null;
    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
    }

    const statuses = await reorderApplicationStatuses(supabase, tenantId, orderedIds);
    return NextResponse.json({ statuses });
  } catch (error) {
    if (error instanceof ApplicationStatusError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[admin/application-statuses/reorder]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder statuses" },
      { status: 500 }
    );
  }
}
