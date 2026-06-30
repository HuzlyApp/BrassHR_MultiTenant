import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  applicantStatusLabel,
  normalizeApplicantStatus,
  type ApplicationStatusKey,
} from "@/lib/applicant-portal";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

function resolveSubmittedAt(input: {
  progressCompletedAt: string | null;
  progressUpdatedAt: string | null;
  stepCompletedAts: Array<string | null | undefined>;
  workerUpdatedAt: string | null;
}): string {
  const candidates = [
    input.progressCompletedAt,
    ...input.stepCompletedAts,
    input.progressUpdatedAt,
    input.workerUpdatedAt,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return new Date().toISOString();
  }

  return candidates.sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
}

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
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

    const [{ data: worker, error: workerError }, progress] = await Promise.all([
      supabase
        .from("worker")
        .select("status, updated_at")
        .eq("id", ctx.workerId)
        .maybeSingle(),
      ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId),
    ]);

    if (workerError) throw workerError;

    const { data: progressRow, error: progressError } = await supabase
      .from("worker_onboarding_progress")
      .select("status, completed_at, updated_at")
      .eq("id", progress.progressId)
      .maybeSingle();

    if (progressError) throw progressError;

    const applicationStatus: ApplicationStatusKey = normalizeApplicantStatus(
      worker?.status as string | null | undefined
    );

    const submittedAt = resolveSubmittedAt({
      progressCompletedAt: progressRow?.completed_at ? String(progressRow.completed_at) : null,
      progressUpdatedAt: progressRow?.updated_at ? String(progressRow.updated_at) : null,
      stepCompletedAts: progress.steps.map((step) => step.completed_at),
      workerUpdatedAt: worker?.updated_at ? String(worker.updated_at) : null,
    });

    return NextResponse.json({
      applicationStatus,
      statusLabel: applicantStatusLabel(worker?.status as string | null | undefined),
      submittedAt,
      onboardingProgressStatus: progressRow?.status ? String(progressRow.status) : progress.status,
    });
  } catch (err: unknown) {
    console.error("[onboarding/application-status]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
