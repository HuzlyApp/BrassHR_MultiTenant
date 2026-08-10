import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatApiError } from "@/lib/api/format-api-error";
import { listWorkersForAuthUser } from "@/lib/onboarding/resolve-worker-context";
import { applicationStatusLabel } from "@/lib/jobs/application-status";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * List all job applications for the authenticated applicant across all
 * tenant-scoped worker rows linked to their auth user.
 */
export async function GET(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workers = await listWorkersForAuthUser(supabase, authData.user.id);
    if (!workers.length) {
      return NextResponse.json({ applications: [] });
    }

    const workerIds = workers.map((w) => w.workerId);
    const tenantIds = [...new Set(workers.map((w) => w.tenantId))];

    const { data: apps, error: appsError } = await supabase
      .from("job_applications")
      .select(
        "id, status, created_at, submitted_at, worker_id, tenant_id, job_requisition_id, job_requisitions(id, public_title, location), tenants:tenant_id(id, name, slug)"
      )
      .in("worker_id", workerIds)
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });

    if (appsError) throw appsError;

    const applications = (apps ?? []).map((row) => {
      const jobRaw = row.job_requisitions;
      const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
      const tenantRaw = row.tenants;
      const tenant = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
      const tenantRecord = (tenant ?? {}) as {
        id?: string;
        name?: string | null;
        slug?: string | null;
      };
      const jobRecord = (job ?? {}) as {
        id?: string;
        public_title?: string | null;
        location?: string | null;
      };

      return {
        applicationId: row.id as string,
        workerId: row.worker_id as string,
        status: row.status as string,
        statusLabel: applicationStatusLabel(String(row.status ?? "")),
        appliedAt: (row.submitted_at ?? row.created_at) as string,
        tenant: {
          id: String(tenantRecord.id ?? row.tenant_id),
          name: tenantRecord.name?.trim() || tenantRecord.slug?.trim() || "Company",
        },
        job: {
          id: String(jobRecord.id ?? row.job_requisition_id),
          title: jobRecord.public_title?.trim() || "Job",
          location: jobRecord.location?.trim() || null,
        },
      };
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[me/applications]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
