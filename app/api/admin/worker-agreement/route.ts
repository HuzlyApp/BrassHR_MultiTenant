import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import type { AgreementRecord } from "@/lib/admin/build-worker-agreement-sections";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 });
    }
    const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }
    const workerId = idCheck.value;

    const auth = await requireApiSession();
    if (auth instanceof NextResponse) return auth;
    if (!isStaffRole(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id")
      .eq("id", workerId)
      .maybeSingle();

    if (workerErr) throw workerErr;
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = worker.user_id != null ? String(worker.user_id).trim() : "";
    if (!userId) {
      return NextResponse.json({ agreements: [] as AgreementRecord[] });
    }

    const { data: agreementRows, error: agreementErr } = await supabase
      .from("agreements")
      .select("id, request_id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (agreementErr) {
      console.warn("[admin/worker-agreement] agreements query failed", agreementErr);
      return NextResponse.json({ agreements: [] as AgreementRecord[] });
    }

    const agreements: AgreementRecord[] = (agreementRows ?? []).map((row) => ({
      id: String(row.id),
      request_id: String(row.request_id),
      status: String(row.status ?? "pending"),
      created_at: row.created_at != null ? String(row.created_at) : null,
      updated_at: null,
    }));

    return NextResponse.json({ agreements });
  } catch (err: unknown) {
    console.error("[admin/worker-agreement]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
