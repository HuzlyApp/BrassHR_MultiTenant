import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { evaluateConversionReadiness } from "@/lib/job-requisitions/evaluate-conversion-readiness";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const { workerId: rawWorkerId } = await context.params;
  const idCheck = parseRequiredUuid(rawWorkerId?.trim() ?? "", "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id, status")
    .eq("id", idCheck.value)
    .maybeSingle();

  if (error) throw error;
  if (!worker) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const readiness = await evaluateConversionReadiness(supabase, idCheck.value);
  return NextResponse.json({ readiness });
}
