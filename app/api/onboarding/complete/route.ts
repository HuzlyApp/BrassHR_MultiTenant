import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { validateWorkerOnboardingComplete } from "@/lib/onboarding/validate-completion";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { applicantId?: string };
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 });
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

    const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);
    const validation = await validateWorkerOnboardingComplete(
      supabase,
      ctx.workerId,
      ctx.tenantId,
      progress.steps
    );

    if (!validation.ok) {
      return NextResponse.json({ ok: false, missing: validation.missing }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("worker_onboarding_progress")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .eq("id", progress.progressId);

    if (upErr) throw upErr;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[onboarding/complete]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
