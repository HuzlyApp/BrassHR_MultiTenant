import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadAgreementSectionFile } from "@/lib/admin/agreement-upload";
import type { AgreementSectionId } from "@/lib/admin/document-review";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "onboarding-agreement-upload",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_HOUR ?? 20),
      windowMs: 60 * 60 * 1000,
      failClosed: false,
    });
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const applicantId = String(formData.get("applicantId") ?? "").trim();
    const sectionRaw = String(formData.get("section") ?? "").trim();
    const requiredDocumentId = String(formData.get("requiredDocumentId") ?? "").trim() || null;

    if (!file || !applicantId) {
      return NextResponse.json({ error: "Missing file or applicantId" }, { status: 400 });
    }

    const section: AgreementSectionId | null =
      sectionRaw === "w2" || sectionRaw === "i9" ? sectionRaw : null;
    if (!section) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveWorkerByApplicantId(supabase, applicantId);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const result = await uploadAgreementSectionFile(supabase, {
      workerId: ctx.workerId,
      tenantId: ctx.tenantId,
      section,
      file,
      requiredDocumentId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error("[onboarding/agreement/upload]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
