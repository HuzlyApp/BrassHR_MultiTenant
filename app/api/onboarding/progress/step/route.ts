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
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";
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

    const config = await loadTenantOnboardingConfig(supabase, ctx.tenantId, {
      workerFacing: true,
    });

    let stepId = body.stepId?.trim() || "";
    if (!stepId && body.stepKey && config) {
      const stepKey = body.stepKey.trim();
      const stepRow =
        config.steps.find((s) => s.step_key === stepKey && s.is_enabled) ??
        config.steps.find((s) => s.step_key === stepKey) ??
        (stepKey === "resume_upload"
          ? config.steps.find((s) => s.step_type === "resume_upload" && s.is_enabled)
          : null);
      stepId = stepRow?.id ? String(stepRow.id) : "";
    }

    if (!stepId) {
      return NextResponse.json({ error: "Step not found" }, { status: 400 });
    }

    const completed_at = status === "completed" ? new Date().toISOString() : null;

    const stepRow = config?.steps.find((s) => s.id === stepId) ?? null;

    if (status === "skipped" && stepRow && isUploadResumeStep(stepRow)) {
      return NextResponse.json({ error: "Upload Resume cannot be skipped." }, { status: 400 });
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

    const { error: upErr } = await supabase
      .from("worker_onboarding_step_progress")
      .update({
        status,
        completed_at,
        data: stepData,
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
