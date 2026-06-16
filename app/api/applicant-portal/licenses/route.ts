import { NextRequest, NextResponse } from "next/server";
import {
  documentStatusLabel,
  LEGACY_DOCUMENT_KEY_BY_LICENSE_TYPE,
  LICENSE_TYPE_LABELS,
  licenseUrgency,
  type LicenseType,
} from "@/lib/applicant-portal/documents";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { uploadApplicantPortalFile } from "@/lib/applicant-portal/upload";

export const runtime = "nodejs";

type LicenseRow = {
  id: string;
  worker_id: string;
  tenant_id: string;
  license_type: LicenseType;
  license_number: string | null;
  expires_at: string | null;
  file_url: string | null;
  storage_path: string | null;
  original_file_name: string | null;
  status: string;
  review_notes: string | null;
  uploaded_at: string;
};

function effectiveStatus(row: LicenseRow): string {
  const urgency = licenseUrgency(row.expires_at, row.status);
  if (urgency === "expired" && row.status === "approved") return "expired";
  return row.status;
}

function serializeLicense(row: LicenseRow) {
  const status = effectiveStatus(row);
  return {
    id: row.id,
    licenseType: row.license_type,
    licenseTypeLabel: LICENSE_TYPE_LABELS[row.license_type] ?? row.license_type,
    licenseNumber: row.license_number,
    expiresAt: row.expires_at,
    expiresAtLabel: row.expires_at ? new Date(row.expires_at).toLocaleDateString() : null,
    status,
    statusLabel: documentStatusLabel(status),
    urgency: licenseUrgency(row.expires_at, status),
    reviewNotes: row.review_notes,
    originalFileName: row.original_file_name,
    uploadedAt: row.uploaded_at,
    hasFile: Boolean(row.storage_path || row.file_url),
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const licensesRes = await auth.supabase
      .from("worker_license_records")
      .select(
        "id, worker_id, tenant_id, license_type, license_number, expires_at, file_url, storage_path, original_file_name, status, review_notes, uploaded_at"
      )
      .eq("worker_id", auth.applicant.id)
      .order("uploaded_at", { ascending: false });
    if (licensesRes.error) throw licensesRes.error;

    const licenses = ((licensesRes.data ?? []) as LicenseRow[]).map(serializeLicense);
    const expired = licenses.filter((item) => item.urgency === "expired");
    const expiringSoon = licenses.filter((item) => item.urgency === "expiring_soon");

    return NextResponse.json({
      licenses,
      summary: {
        total: licenses.length,
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
        pendingReviewCount: licenses.filter((item) =>
          ["pending", "under_review", "needs_revision"].includes(item.status)
        ).length,
      },
    });
  } catch (err) {
    console.error("[applicant-portal/licenses:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load licenses" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const licenseTypeRaw = String(form.get("licenseType") ?? "").trim();
    const expiresAtRaw = String(form.get("expiresAt") ?? "").trim();
    const licenseNumber = String(form.get("licenseNumber") ?? "").trim() || null;
    const file = form.get("file");

    if (!licenseTypeRaw) {
      return NextResponse.json({ error: "License type is required." }, { status: 400 });
    }
    if (!(licenseTypeRaw in LICENSE_TYPE_LABELS)) {
      return NextResponse.json({ error: "Invalid license type." }, { status: 400 });
    }
    if (!expiresAtRaw) {
      return NextResponse.json({ error: "Expiration date is required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "License file is required." }, { status: 400 });
    }

    const licenseType = licenseTypeRaw as LicenseType;
    const { storagePath, publicUrl } = await uploadApplicantPortalFile(
      auth.supabase,
      file,
      auth.applicant.id,
      `licenses/${licenseType}`
    );

    const insertRes = await auth.supabase
      .from("worker_license_records")
      .insert({
        worker_id: auth.applicant.id,
        tenant_id: auth.applicant.tenant_id,
        license_type: licenseType,
        license_number: licenseNumber,
        expires_at: expiresAtRaw,
        file_url: publicUrl,
        storage_path: storagePath,
        original_file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        status: "under_review",
      })
      .select(
        "id, worker_id, tenant_id, license_type, license_number, expires_at, file_url, storage_path, original_file_name, status, review_notes, uploaded_at"
      )
      .single();
    if (insertRes.error) throw insertRes.error;

    const legacyKey = LEGACY_DOCUMENT_KEY_BY_LICENSE_TYPE[licenseType];
    if (legacyKey) {
      const { data: existingDocs } = await auth.supabase
        .from("worker_documents")
        .select("id")
        .eq("worker_id", auth.applicant.id)
        .maybeSingle();

      const docPayload = {
        tenant_id: auth.applicant.tenant_id,
        worker_id: auth.applicant.id,
        [legacyKey]: publicUrl,
        updated_at: new Date().toISOString(),
      };

      if (existingDocs?.id) {
        await auth.supabase.from("worker_documents").update(docPayload).eq("id", existingDocs.id);
      } else {
        await auth.supabase.from("worker_documents").insert(docPayload);
      }

      await auth.supabase.from("worker_legacy_document_reviews").upsert(
        {
          worker_id: auth.applicant.id,
          tenant_id: auth.applicant.tenant_id,
          document_key: legacyKey,
          status: "under_review",
          review_notes: null,
          reviewed_at: null,
          reviewed_by: null,
        },
        { onConflict: "worker_id,document_key" }
      );
    }

    return NextResponse.json({
      ok: true,
      license: serializeLicense(insertRes.data as LicenseRow),
    });
  } catch (err) {
    console.error("[applicant-portal/licenses:post]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not upload license" },
      { status: 500 }
    );
  }
}
