import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import {
  ApplicationStatusError,
  createApplicationStatus,
  countApplicationsByStatus,
  listApplicationStatuses,
} from "@/lib/jobs/application-statuses";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function handleError(error: unknown) {
  if (error instanceof ApplicationStatusError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }
  console.error("[admin/application-statuses]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed to manage statuses" },
    { status: 500 }
  );
}

/** GET — list statuses for the current tenant (staff). ?activeOnly=1 for recruiter dropdowns. */
export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "1";
    const includeCounts = req.nextUrl.searchParams.get("includeCounts") === "1";
    const statuses = await listApplicationStatuses(supabase, tenantId, { activeOnly });
    const canManage = auth.role === "admin" || auth.godAdmin;
    if (!includeCounts) {
      return NextResponse.json({ statuses, canManage });
    }
    const counts = await countApplicationsByStatus(supabase, tenantId, statuses);
    return NextResponse.json({
      statuses: statuses.map((status) => ({
        ...status,
        applicationCount: counts[status.id] ?? 0,
      })),
      canManage,
    });
  } catch (error) {
    return handleError(error);
  }
}

/** POST — create status (admin only). */
export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
      color?: unknown;
      sortOrder?: unknown;
      isActive?: unknown;
      isDefault?: unknown;
    } | null;

    const name = typeof body?.name === "string" ? body.name : "";
    const status = await createApplicationStatus(supabase, {
      tenantId,
      name,
      description: typeof body?.description === "string" ? body.description : null,
      color: typeof body?.color === "string" ? body.color : null,
      sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : undefined,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      isDefault: typeof body?.isDefault === "boolean" ? body.isDefault : undefined,
      createdBy: auth.userId,
    });

    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
