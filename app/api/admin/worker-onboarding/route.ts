import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { mapDynamicAdminOnboardingProgress } from "@/lib/onboarding/map-dynamic-admin-progress";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || "";
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }
  const workerId = idCheck.value;

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const supabase = createClient(url, key);
    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id")
      .eq("id", workerId)
      .maybeSingle();

    if (wErr) throw wErr;
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = String(worker.tenant_id);
    const config = await loadTenantOnboardingConfig(supabase, tenantId);
    const progress = await ensureWorkerOnboardingProgress(supabase, workerId, tenantId);
    const { steps } = await mapDynamicAdminOnboardingProgress(supabase, workerId, tenantId);

    const { data: resume } = await supabase
      .from("worker_resumes")
      .select("file_url, original_file_name, parsed_data, parsing_status, uploaded_at, parsed_at")
      .eq("worker_id", workerId)
      .maybeSingle();

    const { data: documents } = await supabase
      .from("worker_submitted_documents")
      .select(
        "id, required_document_id, file_url, original_file_name, status, uploaded_at, reviewed_at"
      )
      .eq("worker_id", workerId);

    const { data: skillAnswers } = await supabase
      .from("worker_skill_assessment_answers")
      .select("id, assessment_id, question_id, answer, score, submitted_at")
      .eq("worker_id", workerId);

    return NextResponse.json({
      config,
      progress,
      steps,
      resume: resume ?? null,
      documents: documents ?? [],
      skillAnswers: skillAnswers ?? [],
    });
  } catch (err: unknown) {
    console.error("[admin/worker-onboarding]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    documentId?: string;
    status?: "under_review" | "approved" | "rejected" | "needs_revision";
  };

  const documentId = body.documentId?.trim() || "";
  const status = body.status;
  if (!documentId || !status) {
    return NextResponse.json({ error: "Missing documentId or status" }, { status: 400 });
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data: doc, error: dErr } = await supabase
    .from("worker_submitted_documents")
    .select("id, worker_id, tenant_id")
    .eq("id", documentId)
    .maybeSingle();

  if (dErr) throw dErr;
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: worker } = await supabase
    .from("worker")
    .select("id, user_id")
    .eq("id", doc.worker_id)
    .maybeSingle();

  if (!worker || !canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: upErr } = await supabase
    .from("worker_submitted_documents")
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.devBypass ? null : auth.userId,
    })
    .eq("id", documentId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
