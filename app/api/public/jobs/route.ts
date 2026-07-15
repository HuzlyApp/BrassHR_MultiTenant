import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { toPublicJobPayload } from "@/lib/job-requisitions/public-job";
import { jobAcceptsApplications } from "@/lib/job-requisitions/status-transitions";

export const runtime = "nodejs";

/**
 * Public job search / listings for applicants.
 * Only returns Published jobs and public-safe fields.
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const tenant = search.get("tenant")?.trim().toLowerCase() || "";
  const q = search.get("q")?.trim().toLowerCase() || "";
  const profession = search.get("profession")?.trim() || "";
  const specialty = search.get("specialty")?.trim() || "";
  const locationType = search.get("locationType")?.trim() || "";
  const employmentType = search.get("employmentType")?.trim() || "";
  const jobNumber = search.get("jobId")?.trim() || search.get("job_number")?.trim() || "";
  const page = Math.max(1, Number(search.get("page") ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(search.get("pageSize") ?? 20) || 20));

  if (!tenant) {
    return NextResponse.json(
      { code: "TENANT_REQUIRED", message: "Organization is required." },
      { status: 400 }
    );
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, slug, subdomain, is_active, name")
    .or(`slug.eq.${tenant},subdomain.eq.${tenant}`)
    .maybeSingle();

  if (!tenantRow?.id || tenantRow.is_active === false) {
    return NextResponse.json(
      { code: "TENANT_NOT_FOUND", message: "This organization was not found." },
      { status: 404 }
    );
  }

  let query = supabase
    .from("job_requisitions")
    .select(
      "id, job_number, title, description, job_role, profession, specialty, location, location_type, city, state_province, employment_type, benefits_summary, job_duration, target_start_date, required_credentials, qualifications, special_requirements, pay_rate, pay_rate_public, rate_unit, currency, public_job_token, status, published_at, created_at"
    )
    .eq("tenant_id", tenantRow.id)
    .eq("status", "Published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (jobNumber) {
    query = query.ilike("job_number", jobNumber);
  }
  if (profession) {
    query = query.or(`profession.ilike.%${profession}%,job_role.ilike.%${profession}%`);
  }
  if (specialty) {
    query = query.ilike("specialty", `%${specialty}%`);
  }
  if (locationType) {
    query = query.eq("location_type", locationType);
  }
  if (employmentType) {
    query = query.eq("employment_type", employmentType);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let jobs = (data ?? []).filter((j) => jobAcceptsApplications(j.status));
  if (q) {
    jobs = jobs.filter((job) => {
      const hay = [
        job.job_number,
        job.title,
        job.profession,
        job.job_role,
        job.specialty,
        job.location,
        job.city,
        job.description,
        job.qualifications,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const total = jobs.length;
  const start = (page - 1) * pageSize;
  const pageJobs = jobs.slice(start, start + pageSize).map((row) => toPublicJobPayload(row));

  return NextResponse.json({
    tenantSlug: String(tenantRow.slug ?? tenant).toLowerCase(),
    tenantName: tenantRow.name ?? null,
    jobs: pageJobs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
