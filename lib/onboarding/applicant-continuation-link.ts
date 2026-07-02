import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { OnboardingStepType } from "@/lib/onboarding/types";
import { withTenant } from "@/lib/tenant/with-tenant";

const DEFAULT_EXPIRY_HOURS = 72;
const TOKEN_BYTES = 32;

export type ContinuationReason =
  | "onboarding_reminder"
  | "application_status"
  | "resume_continuation"
  | "welcome"
  | "manual_notification";

type WorkerContinuationRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
};

type TenantSlugRow = {
  slug: string | null;
  subdomain?: string | null;
};

export type ApplicantContinuationTarget = {
  path: string;
  stepKey: string | null;
  stepType: OnboardingStepType | null;
};

export type ApplicantContinuationLinkResult = {
  id: string;
  url: string;
  target: ApplicantContinuationTarget;
  expiresAt: string;
};

export function hashContinuationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function expiryHours(): number {
  const raw = Number(process.env.APPLICANT_CONTINUATION_LINK_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 24 * 14) : DEFAULT_EXPIRY_HOURS;
}

function pickTenantSlug(row: TenantSlugRow | null, fallback?: string | null): string | null {
  const slug = row?.slug?.trim().toLowerCase();
  if (slug && slug.length >= 2) return slug;
  const subdomain = row?.subdomain?.trim().toLowerCase();
  if (subdomain && subdomain.length >= 2) return subdomain;
  const fb = fallback?.trim().toLowerCase();
  return fb && fb.length >= 2 ? fb : null;
}

export async function resolveApplicantContinuationTarget(
  supabase: SupabaseClient,
  params: { workerId: string; tenantId: string; tenantSlug?: string | null }
): Promise<ApplicantContinuationTarget> {
  const config = await loadTenantOnboardingConfig(supabase, params.tenantId, {
    workerFacing: true,
  });
  const enabled = getEnabledTenantSteps(config);
  const progress = await ensureWorkerOnboardingProgress(supabase, params.workerId, params.tenantId);
  const byStep = new Map(progress.steps.map((step) => [step.onboarding_step_id, step]));

  const target =
    enabled.find((step) => {
      const status = byStep.get(step.id)?.status ?? "pending";
      return status !== "completed" && status !== "skipped";
    }) ??
    enabled.find((step) => step.step_key === "review_submit" || step.step_type === "review_submit") ??
    enabled[0] ??
    null;

  if (!target) {
    return {
      path: withTenant("/application/add-resume", params.tenantSlug),
      stepKey: null,
      stepType: null,
    };
  }

  return {
    path: withTenant(routeForOnboardingStep(target.step_key, target.step_type), params.tenantSlug),
    stepKey: target.step_key,
    stepType: target.step_type,
  };
}

export async function createApplicantContinuationLink(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    tenantId: string;
    origin: string;
    reason?: ContinuationReason;
    markSent?: boolean;
    tenantSlug?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<ApplicantContinuationLinkResult | null> {
  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, tenant_id, user_id")
    .eq("id", params.workerId)
    .maybeSingle();

  if (workerError) throw workerError;
  const workerRow = worker as WorkerContinuationRow | null;
  if (!workerRow?.id || String(workerRow.tenant_id) !== params.tenantId) return null;

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("slug, subdomain")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  const tenantSlug = pickTenantSlug((tenant as TenantSlugRow | null) ?? null, params.tenantSlug);
  const target = await resolveApplicantContinuationTarget(supabase, {
    workerId: params.workerId,
    tenantId: params.tenantId,
    tenantSlug,
  });

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashContinuationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours() * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("applicant_continuation_links")
    .insert({
      tenant_id: params.tenantId,
      worker_id: params.workerId,
      applicant_user_id: workerRow.user_id,
      token_hash: tokenHash,
      target_path: target.path,
      target_step_key: target.stepKey,
      target_step_type: target.stepType,
      reason: params.reason ?? "onboarding_reminder",
      sent_at: params.markSent ? now.toISOString() : null,
      expires_at: expiresAt,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  const insertedRow = inserted as { id: string };

  const url = new URL("/application/continue", normalizeOrigin(params.origin));
  url.searchParams.set("token", token);

  return {
    id: insertedRow.id,
    url: url.toString(),
    target,
    expiresAt,
  };
}
