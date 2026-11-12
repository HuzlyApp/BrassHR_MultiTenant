import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  loadTenantTaskSettings,
  saveTenantTaskSettings,
} from "@/lib/tasks/task-settings";

function handleError(error: unknown) {
  console.error("[admin/task-settings]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Failed to manage task settings" },
    { status: 500 }
  );
}

function canManageTaskSettings(auth: { godAdmin: boolean; role: string }): boolean {
  return auth.godAdmin || auth.role === "admin" || auth.role === "owner" || auth.role === "hr";
}

export async function GET() {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
    const settings = await loadTenantTaskSettings(supabase, tenantId);
    return NextResponse.json({
      canManage: canManageTaskSettings(auth),
      settings: {
        assignOnlyManagerHr: settings.assignOnlyManagerHr,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  if (!canManageTaskSettings(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as {
      assignOnlyManagerHr?: unknown;
    } | null;

    if (typeof body?.assignOnlyManagerHr !== "boolean") {
      return NextResponse.json(
        { error: "assignOnlyManagerHr must be a boolean" },
        { status: 400 }
      );
    }

    const settings = await saveTenantTaskSettings(supabase, tenantId, {
      assignOnlyManagerHr: body.assignOnlyManagerHr,
    });

    return NextResponse.json({
      ok: true,
      settings: {
        assignOnlyManagerHr: settings.assignOnlyManagerHr,
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
