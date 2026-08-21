import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import {
  documentUploaderRoleDisplay,
  listWorkerDocumentsForApplicant,
} from "@/lib/applicant-portal/worker-document-service";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";

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
    if (!tenantId) {
      return NextResponse.json({ documents: [], missingRequired: [] });
    }

    const [documents, requiredRes, submittedRes] = await Promise.all([
      listWorkerDocumentsForApplicant(supabase, workerId, tenantId),
      supabase
        .from("tenant_required_documents")
        .select("id, title, description, is_required")
        .eq("tenant_id", tenantId),
      supabase
        .from("worker_submitted_documents")
        .select("required_document_id")
        .eq("worker_id", workerId),
    ]);
    if (requiredRes.error) throw requiredRes.error;
    if (submittedRes.error) throw submittedRes.error;

    const missingRequired = (requiredRes.data ?? [])
      .filter((row) => row.is_required)
      .filter(
        (row) => !(submittedRes.data ?? []).some((doc) => doc.required_document_id === row.id)
      )
      .map((row) => ({
        id: String(row.id),
        title: String(row.title ?? "Document"),
        description: (row.description as string | null) ?? null,
      }));

    return NextResponse.json({
      documents: documents
        .filter((doc) => doc.source !== "legacy")
        .map((doc) => ({
          id: doc.id,
          source: doc.source === "required" ? "required" : "portal",
          title: doc.title,
          documentType: doc.source,
          originalFileName: doc.fileName,
          status: doc.status,
          statusLabel: doc.statusLabel,
          reviewNotes: null,
          uploadedAt: doc.uploadedAt,
          uploadedByName: doc.uploadedByName,
          uploadedByRoleLabel: documentUploaderRoleDisplay(doc.uploadedByRoleLabel),
        })),
      missingRequired,
    });
  } catch (err) {
    console.error("[admin/worker-account-documents:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load documents" },
      { status: 500 }
    );
  }
}
