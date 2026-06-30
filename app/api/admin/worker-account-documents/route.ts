import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { requireApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type PortalDocumentRow = {
  id: string;
  title: string;
  document_type: string;
  original_file_name: string | null;
  status: string;
  review_notes: string | null;
  uploaded_at: string;
};

type SubmittedDocumentRow = {
  id: string;
  required_document_id: string;
  original_file_name: string | null;
  status: string;
  review_notes: string | null;
  uploaded_at: string;
};

function serializePortalDocument(row: PortalDocumentRow) {
  return {
    id: row.id,
    source: "portal" as const,
    title: row.title,
    documentType: row.document_type,
    originalFileName: row.original_file_name,
    status: row.status,
    statusLabel: documentStatusLabel(row.status),
    reviewNotes: row.review_notes,
    uploadedAt: row.uploaded_at,
  };
}

function serializeSubmittedDocument(row: SubmittedDocumentRow, requiredTitle: string | null) {
  return {
    id: row.id,
    source: "required" as const,
    title: requiredTitle ?? "Required document",
    documentType: "required",
    originalFileName: row.original_file_name,
    status: row.status,
    statusLabel: documentStatusLabel(row.status),
    reviewNotes: row.review_notes,
    uploadedAt: row.uploaded_at,
    requiredDocumentId: row.required_document_id,
  };
}

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

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);

    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("id, tenant_id, user_id")
      .eq("id", workerId)
      .maybeSingle();

    if (workerErr) throw workerErr;
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    if (
      !canAccessWorkerRecord(auth, {
        id: String(worker.id),
        user_id: (worker as { user_id?: unknown }).user_id,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = String((worker as { tenant_id?: unknown }).tenant_id ?? "").trim();

    const [portalRes, submittedRes, requiredRes] = await Promise.all([
      supabase
        .from("worker_portal_documents")
        .select(
          "id, title, document_type, original_file_name, status, review_notes, uploaded_at"
        )
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("worker_submitted_documents")
        .select(
          "id, required_document_id, original_file_name, status, review_notes, uploaded_at"
        )
        .eq("worker_id", workerId)
        .order("uploaded_at", { ascending: false }),
      tenantId
        ? supabase
            .from("tenant_required_documents")
            .select("id, title, description, is_required")
            .eq("tenant_id", tenantId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (portalRes.error) throw portalRes.error;
    if (submittedRes.error) throw submittedRes.error;
    if (requiredRes.error) throw requiredRes.error;

    const requiredMap = new Map(
      (requiredRes.data ?? []).map((row) => [String(row.id), String(row.title ?? "Document")])
    );

    const portalDocuments = ((portalRes.data ?? []) as PortalDocumentRow[]).map(serializePortalDocument);
    const requiredDocuments = ((submittedRes.data ?? []) as SubmittedDocumentRow[]).map((row) =>
      serializeSubmittedDocument(row, requiredMap.get(row.required_document_id) ?? null)
    );

    const documents = [...portalDocuments, ...requiredDocuments].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    const missingRequired = (requiredRes.data ?? [])
      .filter((row) => row.is_required)
      .filter((row) => !(submittedRes.data ?? []).some((doc) => doc.required_document_id === row.id))
      .map((row) => ({
        id: String(row.id),
        title: String(row.title ?? "Document"),
        description: (row.description as string | null) ?? null,
      }));

    return NextResponse.json({ documents, missingRequired });
  } catch (err) {
    console.error("[admin/worker-account-documents:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load documents" },
      { status: 500 }
    );
  }
}
