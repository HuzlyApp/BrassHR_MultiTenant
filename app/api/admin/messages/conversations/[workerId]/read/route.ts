import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { invalidateUserCache } from "@/lib/cache";

function getServiceClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type RouteContext = { params: Promise<{ workerId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const { workerId: rawWorkerId } = await context.params;
  const workerId = rawWorkerId?.trim() ?? "";
  if (!workerId) {
    return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  try {
    const scope = await resolveStaffTenantScope(auth.authUser);

    let workerQuery = supabase
      .from("worker")
      .select("id, tenant_id")
      .eq("id", workerId)
      .maybeSingle();

    if (scope.mode === "scoped") {
      workerQuery = workerQuery.eq("tenant_id", scope.tenantId);
    }

    const { data: worker, error: workerErr } = await workerQuery;
    if (workerErr) throw workerErr;
    if (!worker?.id || !worker.tenant_id) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error: upsertErr } = await supabase.from("applicant_conversation_reads").upsert(
      {
        tenant_id: worker.tenant_id,
        user_id: auth.userId,
        worker_id: worker.id,
        last_read_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,worker_id" }
    );

    if (upsertErr) throw upsertErr;

    await invalidateUserCache("admin-staff-conversations", auth.userId);

    return NextResponse.json({ ok: true, lastReadAt: now });
  } catch (error) {
    console.error("[admin/messages/conversations/read:post]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to mark conversation read" },
      { status: 500 }
    );
  }
}
