import { NextRequest, NextResponse } from "next/server";
import { uploadAgreementSectionFile } from "@/lib/admin/agreement-upload";
import type { AgreementSectionId } from "@/lib/admin/document-review";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const file = form.get("file");
    const sectionRaw = String(form.get("section") ?? "").trim();
    const requiredDocumentId = String(form.get("requiredDocumentId") ?? "").trim() || null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Document file is required." }, { status: 400 });
    }

    const section: AgreementSectionId | null =
      sectionRaw === "w2" || sectionRaw === "i9" ? sectionRaw : null;
    if (!section) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }

    const result = await uploadAgreementSectionFile(auth.supabase, {
      workerId: auth.applicant.id,
      tenantId: auth.applicant.tenant_id,
      section,
      file,
      requiredDocumentId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[applicant-portal/agreement/upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
