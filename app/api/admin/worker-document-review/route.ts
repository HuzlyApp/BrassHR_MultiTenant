import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import {
  isDocumentReviewStatus,
  LEGACY_DOCUMENT_KEYS,
  type DocumentReviewStatus,
  type LegacyDocumentKey,
} from "@/lib/admin/document-review";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type ReviewBody = {
  workerId?: string;
  submittedDocumentId?: string;
  legacyDocumentKey?: string;
  status?: DocumentReviewStatus;
  reviewNotes?: string;
};

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as ReviewBody;
  const workerIdCheck = parseRequiredUuid(String(body.workerId ?? "").trim(), "workerId");
  if (!workerIdCheck.ok) {
    return NextResponse.json({ error: workerIdCheck.error }, { status: 400 });
  }
  const workerId = workerIdCheck.value;

  const status = body.status?.trim() as DocumentReviewStatus | undefined;
  if (!status || !isDocumentReviewStatus(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const submittedDocumentId = body.submittedDocumentId?.trim() || "";
  const legacyDocumentKey = body.legacyDocumentKey?.trim() || "";
  if (!submittedDocumentId && !legacyDocumentKey) {
    return NextResponse.json(
      { error: "Missing submittedDocumentId or legacyDocumentKey" },
      { status: 400 }
    );
  }
  if (
    legacyDocumentKey &&
    !(LEGACY_DOCUMENT_KEYS as readonly string[]).includes(legacyDocumentKey)
  ) {
    return NextResponse.json({ error: "Invalid legacyDocumentKey" }, { status: 400 });
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

  const tenantId = String(worker.tenant_id);
  const reviewedAt = new Date().toISOString();
  const reviewedBy = auth.devBypass ? null : auth.userId;
  const reviewNotes = body.reviewNotes?.trim() || null;

  if (submittedDocumentId) {
    const { data: doc, error: docErr } = await supabase
      .from("worker_submitted_documents")
      .select("id, worker_id")
      .eq("id", submittedDocumentId)
      .eq("worker_id", workerId)
      .maybeSingle();

    if (docErr) throw docErr;
    if (!doc?.id) {
      return NextResponse.json({ error: "Submitted document not found" }, { status: 404 });
    }

    const { error: upErr } = await supabase
      .from("worker_submitted_documents")
      .update({
        status,
        review_notes: reviewNotes,
        reviewed_at: reviewedAt,
        reviewed_by: reviewedBy,
      })
      .eq("id", submittedDocumentId);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status, submittedDocumentId });
  }

  const documentKey = legacyDocumentKey as LegacyDocumentKey;
  const { data: existing } = await supabase
    .from("worker_legacy_document_reviews")
    .select("id")
    .eq("worker_id", workerId)
    .eq("document_key", documentKey)
    .maybeSingle();

  const row = {
    worker_id: workerId,
    tenant_id: tenantId,
    document_key: documentKey,
    status,
    review_notes: reviewNotes,
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
    updated_at: reviewedAt,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("worker_legacy_document_reviews")
      .update(row)
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("worker_legacy_document_reviews").insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status, legacyDocumentKey: documentKey });
}
