import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

    const [{ data: job, error: jobError }, { data: tenant, error: tenantError }] = await Promise.all([
      supabase
        .from("job_requisitions")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("id, slug, subdomain, name")
        .eq("id", tenantId)
        .maybeSingle(),
    ]);

    if (jobError) throw jobError;
    if (tenantError) throw tenantError;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: applications, error: appsError } = await supabase
      .from("job_applications")
      .select("id, status")
      .eq("job_requisition_id", id)
      .eq("tenant_id", tenantId);
    if (appsError) throw appsError;

    const rows = applications ?? [];
    const applicationsAll = rows.length;
    const applicationsNew = rows.filter((row) => row.status === "submitted").length;
    const applicationsStarted = rows.filter((row) => row.status === "in_progress").length;

    const tenantSlug = String(tenant?.slug ?? tenant?.subdomain ?? "")
      .trim()
      .toLowerCase();
    const publicToken =
      typeof job.public_job_token === "string" ? job.public_job_token.trim() : "";
    const publicJobPath =
      job.status === "published" && publicToken && tenantSlug
        ? `/jobs/${encodeURIComponent(publicToken)}?tenant=${encodeURIComponent(tenantSlug)}`
        : null;

    return NextResponse.json({
      job,
      tenant: tenant
        ? {
            id: String(tenant.id),
            slug: tenantSlug,
            name: String(tenant.name ?? ""),
          }
        : null,
      publicJobPath,
      stats: {
        applicationsAll,
        applicationsNew,
        applicationsStarted,
        applicationsSubmittedOrHired: rows.filter(
          (row) => row.status === "submitted" || row.status === "hired"
        ).length,
        // Performance tracking is not persisted yet — surface zeros for Figma layout.
        impressions: 0,
        clicks: 0,
        totalCost: 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
