import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { workerDisplayName } from "@/lib/messaging/group-conversations";
import { type WorkerSummary } from "@/lib/messaging/staff-conversations";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  try {
    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode !== "scoped") {
      return NextResponse.json({ error: "Select a tenant to search workers." }, { status: 400 });
    }

    const query = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const excludeRaw = req.nextUrl.searchParams.get("excludeGroupId")?.trim() ?? "";

    let workersQuery = supabase
      .from("worker")
      .select("id, first_name, last_name, email, job_role")
      .eq("tenant_id", scope.tenantId)
      .order("first_name", { ascending: true })
      .limit(50);

    const workersRes = await workersQuery;
    if (workersRes.error) throw workersRes.error;

    let workers = (workersRes.data ?? []) as (WorkerSummary & { job_role?: string | null })[];

    if (excludeRaw) {
      const membersRes = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", excludeRaw);
      if (membersRes.error) throw membersRes.error;
      const memberIds = new Set((membersRes.data ?? []).map((row) => String(row.user_id)));
      workers = workers.filter((worker) => !memberIds.has(worker.id));
    }

    if (query) {
      workers = workers.filter((worker) => {
        const haystack = [
          worker.first_name,
          worker.last_name,
          worker.email,
          worker.job_role,
          workerDisplayName(worker),
        ]
          .map((part) => part?.toLowerCase() ?? "")
          .join(" ");
        return haystack.includes(query);
      });
    }

    return NextResponse.json({
      workers: workers.map((worker) => ({
        id: worker.id,
        name: workerDisplayName(worker),
        email: worker.email,
        jobRole: worker.job_role ?? null,
      })),
    });
  } catch (error) {
    console.error("[admin/messages/workers:get]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search workers" },
      { status: 500 }
    );
  }
}
