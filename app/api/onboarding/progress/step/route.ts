import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import type { OnboardingStepStatus } from "@/lib/onboarding/types";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  stepId?: string;
  stepKey?: string;
  status?: OnboardingStepStatus;
  data?: Record<string, unknown>;
};

const ALLOWED: OnboardingStepStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
  "failed",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : "";
    const status = body.status;
    if (!applicantId || !status || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Invalid applicantId or status" }, { status: 400 });
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

    const payload = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);

    let stepId = body.stepId?.trim() || "";
    if (!stepId && body.stepKey) {
      const { data: stepRow } = await supabase
        .from("tenant_onboarding_steps")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("step_key", body.stepKey.trim())
        .maybeSingle();
      stepId = stepRow?.id ? String(stepRow.id) : "";
    }

    if (!stepId) {
      return NextResponse.json({ error: "Step not found" }, { status: 400 });
    }

    const completed_at = status === "completed" ? new Date().toISOString() : null;

    const { error: upErr } = await supabase
      .from("worker_onboarding_step_progress")
      .update({
        status,
        completed_at,
        data: body.data ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("worker_onboarding_progress_id", payload.progressId)
      .eq("onboarding_step_id", stepId);

    if (upErr) throw upErr;

    const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);
    return NextResponse.json({ progress });
  } catch (err: unknown) {
    console.error("[onboarding/progress/step]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
