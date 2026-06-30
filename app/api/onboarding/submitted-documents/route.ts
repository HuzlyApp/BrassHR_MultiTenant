import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import {
  readOnboardingTenantSlugFromRequest,
  resolveOnboardingWorker,
} from "@/lib/onboarding/resolve-onboarding-worker";

export const runtime = "nodejs";

/** Lists worker uploads keyed by tenant_required_documents.id */
export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    const tenantSlug =
      req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
      readOnboardingTenantSlugFromRequest(req);
    if (!applicantId) {
      return NextResponse.json({ documents: [] });
    }

    const url = getSupabaseUrl();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ documents: [] });
    }

    const supabase = createClient(url, key);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json({ documents: [] });
    }

    const { data, error } = await supabase
      .from("worker_submitted_documents")
      .select("required_document_id, original_file_name, status, uploaded_at")
      .eq("worker_id", ctx.workerId);

    if (error) throw error;

    return NextResponse.json({ documents: data ?? [] });
  } catch (err: unknown) {
    console.error("[onboarding/submitted-documents]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
