import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { writeActivityLog } from "@/lib/audit/activity-log";
import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";

export const runtime = "nodejs";

/** List MSPs available to the current tenant (or all for god admin). */
export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const all = req.nextUrl.searchParams.get("all") === "1";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

  if (all) {
    const god = await requireGodAdminApiSession();
    if (god instanceof NextResponse) return god;

    const { data, error } = await supabase
      .from("msps")
      .select("id, name, code, is_active, notes, created_at, updated_at")
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let msps = data ?? [];
    if (q) {
      msps = msps.filter((m) =>
        [m.name, m.code].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return NextResponse.json({ msps });
  }

  const tenantId = await resolveEffectiveAdminTenantId(supabase as OnboardingDbClient, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const { data: associations, error: assocErr } = await supabase
    .from("msp_tenant_associations")
    .select("msp_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (assocErr) {
    // Fallback: list all active MSPs if associations table is empty / unavailable
    const { data, error } = await supabase
      .from("msps")
      .select("id, name, code, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ msps: data ?? [] });
  }

  const mspIds = (associations ?? []).map((a) => String(a.msp_id));
  if (!mspIds.length) {
    const { data, error } = await supabase
      .from("msps")
      .select("id, name, code, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let msps = data ?? [];
    if (q) {
      msps = msps.filter((m) =>
        [m.name, m.code].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return NextResponse.json({ msps });
  }

  const { data, error } = await supabase
    .from("msps")
    .select("id, name, code, is_active")
    .in("id", mspIds)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let msps = data ?? [];
  if (q) {
    msps = msps.filter((m) =>
      [m.name, m.code].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }
  return NextResponse.json({ msps });
}

/** Super Admin: create MSP */
export async function POST(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "MSP name is required" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() || null : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const tenantIds = Array.isArray(body.tenantIds)
    ? body.tenantIds.filter((t): t is string => typeof t === "string")
    : [];

  const { data: existing } = await supabase
    .from("msps")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing?.id) {
    return NextResponse.json(
      { error: "An MSP with this name already exists.", code: "DUPLICATE_MSP" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("msps")
    .insert({
      name,
      code,
      notes,
      is_active: body.isActive !== false,
      created_by: auth.userId,
    })
    .select("id, name, code, is_active, notes, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (tenantIds.length) {
    await supabase.from("msp_tenant_associations").upsert(
      tenantIds.map((tenant_id) => ({
        msp_id: data.id,
        tenant_id,
        is_active: true,
      }))
    );
  }

  void writeActivityLog({
    actorUserId: auth.userId,
    action: "msp_created",
    entityType: "msps",
    entityId: data.id,
    metadata: { name: data.name },
    request: req,
  });

  return NextResponse.json({ msp: data }, { status: 201 });
}
