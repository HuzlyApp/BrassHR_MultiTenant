import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requestAgreementUpload } from "@/lib/admin/agreement-upload";
import type { AgreementSectionId } from "@/lib/admin/document-review";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RequestBody = {
  workerId?: string;
  section?: AgreementSectionId;
  title?: string;
  submittedDocumentId?: string;
  legacyDocumentKey?: string;
  message?: string;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession();
    if (auth instanceof NextResponse) return auth;
    if (!isStaffRole(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as RequestBody;
    const workerIdCheck = parseRequiredUuid(String(body.workerId ?? "").trim(), "workerId");
    if (!workerIdCheck.ok) {
      return NextResponse.json({ error: workerIdCheck.error }, { status: 400 });
    }
    const workerId = workerIdCheck.value;

    const section = body.section;
    if (section !== "w2" && section !== "i9") {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id")
      .eq("id", workerId)
      .maybeSingle();

    if (workerErr) throw workerErr;
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const title =
      body.title?.trim() ||
      (section === "w2" ? "Employee Agreement W2" : "I9 Form");

    await requestAgreementUpload(supabase, {
      workerId,
      tenantId: String(worker.tenant_id),
      section,
      title,
      submittedDocumentId: body.submittedDocumentId?.trim() || null,
      legacyDocumentKey: body.legacyDocumentKey?.trim() || null,
      recruiterUserId: auth.devBypass ? null : auth.userId,
      message: body.message?.trim() || null,
    });

    return NextResponse.json({ ok: true, section, status: "needs_revision" });
  } catch (err) {
    console.error("[admin/worker-agreement-upload-request]", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
