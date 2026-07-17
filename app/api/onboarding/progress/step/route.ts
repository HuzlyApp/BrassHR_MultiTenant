import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import {
  readOnboardingTenantSlugFromRequest,
  resolveOnboardingWorker,
} from "@/lib/onboarding/resolve-onboarding-worker";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { dispatchWorkflowIntegrationPartner } from "@/lib/onboarding/integration-partner-dispatch";
import { notifyHrOnOnboardingStepFailure } from "@/lib/onboarding/notify-hr-on-step-failure";
import { shouldPauseFlowOnStepFailure } from "@/lib/onboarding/workflow-settings";
import { isUploadResumeStep } from "@/lib/onboarding/enforce-upload-resume-first";
import { isOnboardingStepSkippable } from "@/lib/onboarding/is-step-skippable";
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import { persistFarthestReachedStepIndex } from "@/lib/onboarding/persist-farthest-reached-step";
import { resolveOnboardingProgressStep } from "@/lib/onboarding/resolve-onboarding-progress-step";
import type { OnboardingStepStatus } from "@/lib/onboarding/types";

export const runtime = "nodejs";

type Body = {
  applicantId?: string;
  tenantSlug?: string;
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
    const tenantSlug =
      (typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : "") ||
      readOnboardingTenantSlugFromRequest(req);
    const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
    if (!ctx) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    const payload = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);

    let config = await loadTenantOnboardingConfig(supabase, ctx.tenantId, {
      workerFacing: true,
    });

    let stepRow = resolveOnboardingProgressStep(config, {
      stepId: body.stepId,
      stepKey: body.stepKey,
    });

    let progressPayload = payload;

    // Stale tenant config cache can omit a just-published step key (e.g. custom_question).
    if (!stepRow && (body.stepId?.trim() || body.stepKey?.trim())) {
      config = await loadTenantOnboardingConfig(supabase, ctx.tenantId, {
        workerFacing: true,
        bypassCache: true,
      });
      stepRow = resolveOnboardingProgressStep(config, {
        stepId: body.stepId,
        stepKey: body.stepKey,
      });
      if (stepRow) {
        progressPayload = await ensureWorkerOnboardingProgress(
          supabase,
          ctx.workerId,
          ctx.tenantId
        );
      }
    }

    const stepId = stepRow?.id ? String(stepRow.id) : "";
    if (!stepId) {
      return NextResponse.json({ error: "Step not found" }, { status: 400 });
    }

    const completed_at = status === "completed" ? new Date().toISOString() : null;

    if (status === "skipped" && stepRow && isUploadResumeStep(stepRow)) {
      return NextResponse.json({ error: "Upload Resume cannot be skipped." }, { status: 400 });
    }

    if (status === "skipped" && stepRow && !isOnboardingStepSkippable(stepRow)) {
      return NextResponse.json(
        { error: "This required step cannot be skipped." },
        { status: 400 }
      );
    }

    if (status === "completed" && stepRow && isUploadResumeStep(stepRow)) {
      const { data: worker, error: workerErr } = await supabase
        .from("worker")
        .select("email")
        .eq("id", ctx.workerId)
        .maybeSingle();
      if (workerErr) throw workerErr;
      const email = String(worker?.email ?? "").trim();
      if (email && !isValidStep1Email(email)) {
        return NextResponse.json(
          { error: "Enter a valid email address before continuing onboarding." },
          { status: 400 }
        );
      }

      const { data: resume } = await supabase
        .from("worker_resumes")
        .select("file_url")
        .eq("worker_id", ctx.workerId)
        .maybeSingle();
      const { data: requirements } = await supabase
        .from("worker_requirements")
        .select("resume_path")
        .or(`worker_id.eq.${ctx.workerId},worker_id.eq.${applicantId}`)
        .maybeSingle();
      const resumePath = String(requirements?.resume_path ?? "").trim();
      if (!resume?.file_url && !resumePath) {
        return NextResponse.json(
          { error: "Upload your resume before continuing onboarding." },
          { status: 400 }
        );
      }
    }

    const { data: existingRow } = await supabase
      .from("worker_onboarding_step_progress")
      .select("status")
      .eq("worker_onboarding_progress_id", progressPayload.progressId)
      .eq("onboarding_step_id", stepId)
      .maybeSingle();

    const existingStatus = existingRow?.status as OnboardingStepStatus | undefined;
    const terminalStatuses: OnboardingStepStatus[] = ["completed", "skipped"];
    const downgradeStatuses: OnboardingStepStatus[] = ["pending", "in_progress"];
    if (
      existingStatus &&
      terminalStatuses.includes(existingStatus) &&
      downgradeStatuses.includes(status)
    ) {
      const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);
      return NextResponse.json({ progress, noop: true });
    }

    let stepData: Record<string, unknown> =
      body.data && typeof body.data === "object" ? { ...body.data } : {};

    if (status === "in_progress" && stepRow) {
      const dispatch = await dispatchWorkflowIntegrationPartner({
        supabase,
        tenantId: ctx.tenantId,
        workerId: ctx.workerId,
        applicantId,
        step: stepRow,
        request: req,
      });
      stepData = {
        ...stepData,
        partner_dispatch: dispatch,
      };
    }

    if (status === "failed" && stepRow) {
      const failureReason =
        typeof body.data?.failure_reason === "string"
          ? body.data.failure_reason
          : typeof body.data?.reason === "string"
            ? body.data.reason
            : null;

      if (shouldPauseFlowOnStepFailure(stepRow)) {
        stepData = {
          ...stepData,
          flow_paused: true,
          pause_reason: failureReason ?? "step_failed",
        };
      }

      await notifyHrOnOnboardingStepFailure({
        supabase,
        tenantId: ctx.tenantId,
        workerId: ctx.workerId,
        applicantId,
        step: stepRow,
        failureReason,
        request: req,
      });
    }

    const { data: existingProgressRow } = await supabase
      .from("worker_onboarding_step_progress")
      .select("onboarding_step_id")
      .eq("worker_onboarding_progress_id", progressPayload.progressId)
      .eq("onboarding_step_id", stepId)
      .maybeSingle();

    if (!existingProgressRow) {
      const { error: insertMissingErr } = await supabase
        .from("worker_onboarding_step_progress")
        .insert({
          worker_onboarding_progress_id: progressPayload.progressId,
          worker_id: ctx.workerId,
          tenant_id: ctx.tenantId,
          onboarding_step_id: stepId,
          status: "pending",
        });
      if (insertMissingErr && insertMissingErr.code !== "23505") throw insertMissingErr;
    }

    const { error: upErr } = await supabase
      .from("worker_onboarding_step_progress")
      .update({
        status,
        completed_at,
        data: stepData,
        updated_at: new Date().toISOString(),
      })
      .eq("worker_onboarding_progress_id", progressPayload.progressId)
      .eq("onboarding_step_id", stepId);

    if (upErr) throw upErr;

    if (config) {
      const enabledSteps = getEnabledTenantSteps(config);
      await persistFarthestReachedStepIndex(
        supabase,
        progressPayload.progressId,
        enabledSteps,
        stepId,
        status,
        progressPayload.farthestReachedStepIndex ?? 1
      );
    }

    const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);
    return NextResponse.json({ progress });
  } catch (err: unknown) {
    console.error("[onboarding/progress/step]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
