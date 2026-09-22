import { NextRequest, NextResponse } from "next/server";
import { EMPLOYMENT_TYPES } from "@/lib/jobs/types";
import { JOB_LOCATION_TYPES } from "@/lib/jobs/public-jobs-board";
import { listPublicJobs } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveRequestTenantHost } from "@/lib/tenant/resolve-tenant-context";

export const runtime = "nodejs";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function resolvePublicJobsTenantSlug(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();
  if (fromQuery && fromQuery.length >= 2) return fromQuery;
  const fromHeader = req.headers.get("x-tenant-slug")?.trim().toLowerCase();
  if (fromHeader && fromHeader.length >= 2) return fromHeader;
  const { subdomainLabel } = resolveRequestTenantHost(req.headers);
  return subdomainLabel;
}

export async function GET(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Jobs are temporarily unavailable" }, { status: 503 });

  try {
    const tenant = await resolvePublicTenant(supabase, resolvePublicJobsTenantSlug(req));
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

    const employmentType = req.nextUrl.searchParams.get("employmentType") || undefined;
    const locationType = req.nextUrl.searchParams.get("locationType") || undefined;
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
      locationType:
        locationType && JOB_LOCATION_TYPES.includes(locationType as (typeof JOB_LOCATION_TYPES)[number])
          ? locationType
          : undefined,
      page: Number(req.nextUrl.searchParams.get("page") || 1),
      pageSize: Number(req.nextUrl.searchParams.get("pageSize") || 12),
    });

    const [professions, specialties, usedFilterIds] = await Promise.all([
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
      supabase
        .from("job_requisitions")
        .select("profession_id, specialty_id")
        .eq("tenant_id", tenant.id)
        .in("status", ["open", "published"])
        .not("public_job_token", "is", null),
    ]);

    const usedProfessionIds = new Set(
      (usedFilterIds.data ?? [])
        .map((row) => (row.profession_id ? String(row.profession_id) : ""))
        .filter(Boolean)
    );
    const usedSpecialtyIds = new Set(
      (usedFilterIds.data ?? [])
        .map((row) => (row.specialty_id ? String(row.specialty_id) : ""))
        .filter(Boolean)
    );

    return NextResponse.json({
      ...result,
      tenant,
      filters: {
        // Only offer profession/specialty values that can return board results.
        professions: (professions.data ?? []).filter((item) => usedProfessionIds.has(String(item.id))),
        specialties: (specialties.data ?? []).filter((item) => usedSpecialtyIds.has(String(item.id))),
        employmentTypes: EMPLOYMENT_TYPES,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: apiErrorMessage(error, "Failed to load jobs") },
      { status: 500 }
    );
  }
}
