import { NextRequest, NextResponse } from "next/server";
import { documentStatusLabel } from "@/lib/applicant-portal/documents";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { createSignedPortalFileUrl, uploadApplicantPortalFile } from "@/lib/applicant-portal/upload";

export const runtime = "nodejs";

type PortalDocumentRow = {
  id: string;
  title: string;
  document_type: string;
  original_file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  review_notes: string | null;
  uploaded_at: string;
  storage_path: string;
};

type SubmittedDocumentRow = {
  id: string;
  required_document_id: string;
  original_file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  review_notes: string | null;
  uploaded_at: string;
  file_url: string;
};

function serializePortalDocument(row: PortalDocumentRow) {
  return {
    id: row.id,
    source: "portal" as const,
    title: row.title,
    documentType: row.document_type,
    originalFileName: row.original_file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    status: row.status,
    statusLabel: documentStatusLabel(row.status),
    reviewNotes: row.review_notes,
    uploadedAt: row.uploaded_at,
  };
}

function serializeSubmittedDocument(
  row: SubmittedDocumentRow,
  requiredTitle: string | null,
  requiredDescription: string | null
) {
  return {
    id: row.id,
    source: "required" as const,
    title: requiredTitle ?? "Required document",
    documentType: requiredDescription ?? "required",
    originalFileName: row.original_file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    status: row.status,
    statusLabel: documentStatusLabel(row.status),
    reviewNotes: row.review_notes,
    uploadedAt: row.uploaded_at,
    requiredDocumentId: row.required_document_id,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const [portalRes, submittedRes, requiredRes] = await Promise.all([
      auth.supabase
        .from("worker_portal_documents")
        .select(
          "id, title, document_type, original_file_name, file_type, file_size, status, review_notes, uploaded_at, storage_path"
        )
        .eq("worker_id", auth.applicant.id)
        .order("uploaded_at", { ascending: false }),
      auth.supabase
        .from("worker_submitted_documents")
        .select(
          "id, required_document_id, original_file_name, file_type, file_size, status, review_notes, uploaded_at, file_url"
        )
        .eq("worker_id", auth.applicant.id)
        .order("uploaded_at", { ascending: false }),
      auth.supabase
        .from("tenant_required_documents")
        .select("id, title, description, is_required")
        .eq("tenant_id", auth.applicant.tenant_id),
    ]);
    if (portalRes.error) throw portalRes.error;
    if (submittedRes.error) throw submittedRes.error;
    if (requiredRes.error) throw requiredRes.error;

    const requiredMap = new Map(
      (requiredRes.data ?? []).map((row) => [
        String(row.id),
        { title: row.title as string, description: row.description as string | null },
      ])
    );

    const portalDocuments = ((portalRes.data ?? []) as PortalDocumentRow[]).map(serializePortalDocument);
    const requiredDocuments = ((submittedRes.data ?? []) as SubmittedDocumentRow[]).map((row) => {
      const meta = requiredMap.get(row.required_document_id);
      return serializeSubmittedDocument(row, meta?.title ?? null, meta?.description ?? null);
    });

    const missingRequired = (requiredRes.data ?? [])
      .filter((row) => row.is_required)
      .filter((row) => !(submittedRes.data ?? []).some((doc) => doc.required_document_id === row.id))
      .map((row) => ({
        id: String(row.id),
        title: row.title as string,
        description: (row.description as string | null) ?? null,
        isRequired: true,
      }));

    return NextResponse.json({
      portalDocuments,
      requiredDocuments,
      missingRequired,
    });
  } catch (err) {
    console.error("[applicant-portal/documents:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load documents" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const title = String(form.get("title") ?? "").trim();
    const documentType = String(form.get("documentType") ?? "other").trim() || "other";
    const requiredDocumentId = String(form.get("requiredDocumentId") ?? "").trim();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Document file is required." }, { status: 400 });
    }

    const { storagePath, publicUrl } = await uploadApplicantPortalFile(
      auth.supabase,
      file,
      auth.applicant.id,
      requiredDocumentId ? `required/${requiredDocumentId}` : "other"
    );

    if (requiredDocumentId) {
      const upsertRes = await auth.supabase
        .from("worker_submitted_documents")
        .upsert(
          {
            worker_id: auth.applicant.id,
            tenant_id: auth.applicant.tenant_id,
            required_document_id: requiredDocumentId,
            file_url: publicUrl,
            original_file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
            status: "under_review",
            uploaded_at: new Date().toISOString(),
            review_notes: null,
            reviewed_at: null,
            reviewed_by: null,
          },
          { onConflict: "worker_id,required_document_id" }
        )
        .select(
          "id, required_document_id, original_file_name, file_type, file_size, status, review_notes, uploaded_at, file_url"
        )
        .single();
      if (upsertRes.error) throw upsertRes.error;

      const requiredRes = await auth.supabase
        .from("tenant_required_documents")
        .select("title, description")
        .eq("id", requiredDocumentId)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        document: serializeSubmittedDocument(
          upsertRes.data as SubmittedDocumentRow,
          (requiredRes.data?.title as string | undefined) ?? null,
          (requiredRes.data?.description as string | null | undefined) ?? null
        ),
      });
    }

    if (!title) {
      return NextResponse.json({ error: "Document title is required." }, { status: 400 });
    }

    const insertRes = await auth.supabase
      .from("worker_portal_documents")
      .insert({
        worker_id: auth.applicant.id,
        tenant_id: auth.applicant.tenant_id,
        title,
        document_type: documentType,
        file_url: publicUrl,
        storage_path: storagePath,
        original_file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        status: "under_review",
      })
      .select(
        "id, title, document_type, original_file_name, file_type, file_size, status, review_notes, uploaded_at, storage_path"
      )
      .single();
    if (insertRes.error) throw insertRes.error;

    return NextResponse.json({
      ok: true,
      document: serializePortalDocument(insertRes.data as PortalDocumentRow),
    });
  } catch (err) {
    console.error("[applicant-portal/documents:post]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not upload document" },
      { status: 500 }
    );
  }
}
