import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type PipelineStatus = "new" | "pending" | "approved" | "disapproved";

function parsePipelineStatus(value: unknown): PipelineStatus | null {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    status === "new" ||
    status === "pending" ||
    status === "approved" ||
    status === "disapproved"
  ) {
    return status;
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      workerId?: string;
      status?: string;
    };
    const idCheck = parseRequiredUuid(body.workerId?.trim() ?? "", "workerId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const status = parsePipelineStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "Invalid worker status" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("worker")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", idCheck.value)
      .select("id, status")
      .maybeSingle();

    if (updateError) throw updateError;
    return NextResponse.json({ worker: updated });
  } catch (err) {
    console.error("[admin/workers/status]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
