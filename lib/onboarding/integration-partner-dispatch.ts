import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { getWorkflowSettings } from "@/lib/onboarding/workflow-settings";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export type PartnerDispatchMode = "manual" | "checker" | "third_party" | "skipped";
export type PartnerDispatchStatus = "pending" | "dispatched" | "not_configured" | "skipped";

export type PartnerDispatchResult = {
  mode: PartnerDispatchMode;
  status: PartnerDispatchStatus;
  provider: string | null;
  detail: string;
};

/**
 * Records how a step should be fulfilled via Manual / Checker / third-party settings.
 * Live Checker HTTP calls only run when CHECKER_PARTNER_API_URL is configured.
 */
export async function dispatchWorkflowIntegrationPartner(params: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicantId: string;
  step: TenantOnboardingStep;
  request?: Request;
}): Promise<PartnerDispatchResult> {
  const settings = getWorkflowSettings(params.step);
  const provider = settings.provider?.trim() || null;

  if (!settings.useBraasPartner) {
    return {
      mode: "skipped",
      status: "skipped",
      provider,
      detail: "Integration partner disabled for this step",
    };
  }

  if (!provider || provider === "Manual") {
    await writeActivityLog({
      actorUserId: null,
      action: "workflow_partner_dispatch",
      entityType: "onboarding_step",
      entityId: params.step.id,
      tenantId: params.tenantId,
      metadata: {
        tenant_id: params.tenantId,
        worker_id: params.workerId,
        applicant_id: params.applicantId,
        step_key: params.step.step_key,
        provider: provider ?? "Manual",
        mode: "manual",
        status: "pending",
      },
      request: params.request,
    });
    return {
      mode: "manual",
      status: "pending",
      provider: provider ?? "Manual",
      detail: "Manual completion — no external API call",
    };
  }

  if (provider === "Checker (connected)") {
    const apiUrl = process.env.CHECKER_PARTNER_API_URL?.trim();
    if (!apiUrl) {
      await writeActivityLog({
        actorUserId: null,
        action: "workflow_partner_dispatch_skipped",
        entityType: "onboarding_step",
        entityId: params.step.id,
        tenantId: params.tenantId,
        metadata: {
          tenant_id: params.tenantId,
          step_key: params.step.step_key,
          provider,
          reason: "CHECKER_PARTNER_API_URL not configured",
        },
        request: params.request,
      });
      return {
        mode: "checker",
        status: "not_configured",
        provider,
        detail: "Checker API URL is not configured (CHECKER_PARTNER_API_URL)",
      };
    }

    let httpStatus: number | null = null;
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: params.tenantId,
          workerId: params.workerId,
          applicantId: params.applicantId,
          stepKey: params.step.step_key,
          stepId: params.step.id,
        }),
      });
      httpStatus = res.status;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Checker request failed";
      await writeActivityLog({
        actorUserId: null,
        action: "workflow_partner_dispatch_failed",
        entityType: "onboarding_step",
        entityId: params.step.id,
        tenantId: params.tenantId,
        metadata: {
          tenant_id: params.tenantId,
          step_key: params.step.step_key,
          provider,
          error: msg,
        },
        request: params.request,
      });
      return {
        mode: "checker",
        status: "not_configured",
        provider,
        detail: msg,
      };
    }

    await writeActivityLog({
      actorUserId: null,
      action: "workflow_partner_dispatch",
      entityType: "onboarding_step",
      entityId: params.step.id,
      tenantId: params.tenantId,
      metadata: {
        tenant_id: params.tenantId,
        worker_id: params.workerId,
        applicant_id: params.applicantId,
        step_key: params.step.step_key,
        provider,
        mode: "checker",
        http_status: httpStatus,
      },
      request: params.request,
    });

    return {
      mode: "checker",
      status: "dispatched",
      provider,
      detail: `Checker partner request completed (HTTP ${httpStatus})`,
    };
  }

  const webhook = process.env.WORKFLOW_PARTNER_WEBHOOK_URL?.trim();
  if (!webhook) {
    return {
      mode: "third_party",
      status: "not_configured",
      provider,
      detail: "Third-party webhook not configured (WORKFLOW_PARTNER_WEBHOOK_URL)",
    };
  }

  let httpStatus: number | null = null;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: params.tenantId,
        workerId: params.workerId,
        applicantId: params.applicantId,
        stepKey: params.step.step_key,
        provider,
      }),
    });
    httpStatus = res.status;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Partner webhook failed";
    return { mode: "third_party", status: "not_configured", provider, detail: msg };
  }

  await writeActivityLog({
    actorUserId: null,
    action: "workflow_partner_dispatch",
    entityType: "onboarding_step",
    entityId: params.step.id,
    tenantId: params.tenantId,
    metadata: {
      tenant_id: params.tenantId,
      step_key: params.step.step_key,
      provider,
      mode: "third_party",
      http_status: httpStatus,
    },
    request: params.request,
  });

  return {
    mode: "third_party",
    status: "dispatched",
    provider,
    detail: `Third-party webhook invoked (HTTP ${httpStatus})`,
  };
}
