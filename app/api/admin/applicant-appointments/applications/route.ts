import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export type InterviewApplicationOption = {
  id: string;
  jobId: string | null;
  jobTitle: string;
  status: string;
  appliedAt: string | null;
};

type ApplicationRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  submitted_at: string | null;
  job_requisition_id: string | null;
};

type JobRow = {
  id: string;
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
};

/** Applications a worker can be interviewed for, used by the Schedule Interview job dropdown. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant before scheduling interviews." }, { status: 400 });
    }

    const workerId = req.nextUrl.searchParams.get("workerId")?.trim() ?? "";
    if (!workerId) return NextResponse.json({ applications: [] });

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase
      .from("job_applications")
      .select("id, status, created_at, submitted_at, job_requisition_id")
      .eq("tenant_id", scope.tenantId)
      .eq("worker_id", workerId)
      .not("status", "in", '("rejected","withdrawn")')
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const rows = (data ?? []) as unknown as ApplicationRow[];
    const jobIds = Array.from(
      new Set(rows.map((row) => String(row.job_requisition_id ?? "").trim()).filter(Boolean))
    );

    const jobById = new Map<string, JobRow>();
    if (jobIds.length > 0) {
      const { data: jobRows, error: jobError } = await supabase
        .from("job_requisitions")
        .select("id, public_title, source_job_title, source_type, employment_type")
        .eq("tenant_id", scope.tenantId)
        .in("id", jobIds);
      if (jobError) throw jobError;
      for (const row of (jobRows ?? []) as unknown as JobRow[]) {
        jobById.set(String(row.id), row);
      }
    }

    const applications: InterviewApplicationOption[] = rows.map((row) => {
      const jobId = String(row.job_requisition_id ?? "").trim() || null;
      const job = jobId ? jobById.get(jobId) : null;
      return {
        id: String(row.id),
        jobId,
        jobTitle: (job ? publicJobDisplayTitle(job) : "").trim() || "Untitled job",
        status: String(row.status ?? "").trim().toLowerCase(),
        appliedAt: row.submitted_at ?? row.created_at ?? null,
      };
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[admin/applicant-appointments/applications:get]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
