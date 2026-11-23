import { NextRequest, NextResponse } from "next/server";
import { candidateProfileHref } from "@/app/admin_recruiter/candidates/candidate-links";
import type { AdminHeaderSearchItem } from "@/lib/admin/admin-header-search";
import { formatApiError } from "@/lib/api/format-api-error";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
  status: string | null;
};

type JobRow = {
  id: string;
  public_title: string | null;
  source_job_title: string | null;
  status: string | null;
  location: string | null;
};

function personName(row: WorkerRow): string {
  const full = [row.first_name, row.last_name].map((part) => part?.trim()).filter(Boolean).join(" ");
  return full || row.email?.trim() || "Unnamed person";
}

function jobTitle(row: JobRow): string {
  return (
    row.public_title?.trim() ||
    row.source_job_title?.trim() ||
    "Untitled job"
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Tenant required." }, { status: 400 });
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ people: [], jobs: [] satisfies AdminHeaderSearchItem[] });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
    }

    const safe = q.replace(/[%_,]/g, " ").replace(/"/g, "").trim();
    const quoted = `"%${safe}%"`;
    const tenantId = scope.tenantId;

    const [peopleRes, jobsRes] = await Promise.all([
      supabase
        .from("workers")
        .select("id, first_name, last_name, email, job_role, status")
        .eq("tenant_id", tenantId)
        .or(
          [
            `first_name.ilike.${quoted}`,
            `last_name.ilike.${quoted}`,
            `email.ilike.${quoted}`,
            `job_role.ilike.${quoted}`,
          ].join(",")
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("job_requisitions")
        .select("id, public_title, source_job_title, status, location")
        .eq("tenant_id", tenantId)
        .or(
          [
            `public_title.ilike.${quoted}`,
            `source_job_title.ilike.${quoted}`,
            `location.ilike.${quoted}`,
          ].join(",")
        )
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (peopleRes.error) throw peopleRes.error;
    if (jobsRes.error) throw jobsRes.error;

    const people: AdminHeaderSearchItem[] = ((peopleRes.data ?? []) as WorkerRow[]).map((row) => {
      const name = personName(row);
      const role = row.job_role?.trim();
      const status = row.status?.trim();
      return {
        id: `person:${row.id}`,
        label: name,
        description: [role, status].filter(Boolean).join(" · ") || "Candidate / worker",
        href: candidateProfileHref(row.id),
        kind: "person" as const,
      };
    });

    const jobs: AdminHeaderSearchItem[] = ((jobsRes.data ?? []) as JobRow[]).map((row) => {
      const title = jobTitle(row);
      const status = row.status?.trim();
      const location = row.location?.trim();
      return {
        id: `job:${row.id}`,
        label: title,
        description: [status, location].filter(Boolean).join(" · ") || "Job requisition",
        href: `/admin_recruiter/jobs/${row.id}`,
        kind: "job" as const,
      };
    });

    return NextResponse.json({ people, jobs });
  } catch (err) {
    console.error("[admin/header-search GET]", err);
    return NextResponse.json(
      { error: formatApiError(err, "Failed to search.") },
      { status: 500 }
    );
  }
}
