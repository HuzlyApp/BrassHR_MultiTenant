import { NextRequest, NextResponse } from "next/server";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";
import { listPublicJobs } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Jobs are temporarily unavailable" }, { status: 503 });

  try {
    const tenant = await resolvePublicTenant(supabase, req.nextUrl.searchParams.get("tenant"));
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const employmentType = req.nextUrl.searchParams.get("employmentType") || undefined;
    const result = await listPublicJobs(supabase, tenant.id, {
      query: req.nextUrl.searchParams.get("q") || undefined,
      professionId: req.nextUrl.searchParams.get("professionId") || undefined,
      specialtyId: req.nextUrl.searchParams.get("specialtyId") || undefined,
      location: req.nextUrl.searchParams.get("location") || undefined,
      employmentType:
        employmentType &&
        EMPLOYMENT_TYPES.includes(employmentType as (typeof EMPLOYMENT_TYPES)[number])
          ? employmentType
          : undefined,
      page: Number(req.nextUrl.searchParams.get("page") || 1),
      pageSize: Number(req.nextUrl.searchParams.get("pageSize") || 12),
    });

    const [professions, specialties] = await Promise.all([
      supabase
        .from("professions")
        .select("id, name")
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("specialties")
        .select("id, profession_id, name")
        .or(`tenant_id.is.null,tenant_id.eq.${tenant.id}`)
        .eq("is_active", true)
        .order("name"),
    ]);

    return NextResponse.json({
      ...result,
      tenant,
      filters: {
        professions: professions.data ?? [],
        specialties: specialties.data ?? [],
        employmentTypes: EMPLOYMENT_TYPES,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load jobs" },
      { status: 500 }
    );
  }
}
