import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import {
  isVerifiedInfoCategory,
  VERIFIED_INFO_CATEGORIES,
} from "@/lib/jobs/match-analysis/workspace";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function loadApplication(
  supabase: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  tenantId: string,
  applicationId: string
) {
  const { data, error } = await supabase
    .from("job_applications")
    .select("id")
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  const { id } = await context.params;
  const application = await loadApplication(supabase, tenantId, id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("job_application_verified_information")
    .select("id, category, title, details, verified_by, verified_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("application_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  const { id } = await context.params;
  const application = await loadApplication(supabase, tenantId, id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    category?: string;
    title?: string;
    details?: string;
  };
  const category = String(body.category ?? "note").trim();
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!isVerifiedInfoCategory(category)) {
    return NextResponse.json(
      { error: `Invalid category. Expected one of: ${VERIFIED_INFO_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("job_application_verified_information")
    .insert({
      tenant_id: tenantId,
      application_id: id,
      category,
      title,
      details: typeof body.details === "string" ? body.details.trim() || null : null,
      verified_by: auth.devBypass ? null : auth.userId,
    })
    .select("id, category, title, details, verified_by, verified_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "job_application.verified_information_added",
    entityType: "job_application",
    entityId: id,
    tenantId,
    request: req,
    metadata: { category, title },
  });

  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  const { id } = await context.params;
  const itemId = req.nextUrl.searchParams.get("itemId")?.trim() ?? "";
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const { error } = await supabase
    .from("job_application_verified_information")
    .delete()
    .eq("id", itemId)
    .eq("application_id", id)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
