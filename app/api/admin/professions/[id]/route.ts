import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { requireWorkflowAdmin } from "@/lib/auth/workflow-admin";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { deactivateTenantProfession, renameTenantProfession } from "@/lib/professions/service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = typeof body.name === "string" ? body.name : "";

  try {
    const profession = await renameTenantProfession(supabase, tenantId, id, name);
    return NextResponse.json({ profession });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update profession";
    const status = /already exists/i.test(message)
      ? 409
      : /not found/i.test(message)
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireWorkflowAdmin(auth);
  if (forbidden) return forbidden;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const profession = await deactivateTenantProfession(supabase, tenantId, id);
    return NextResponse.json({ profession });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete profession";
    const status = /onboarding flows/i.test(message)
      ? 409
      : /not found/i.test(message)
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
