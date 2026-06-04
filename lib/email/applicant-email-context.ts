import type { SupabaseClient } from "@supabase/supabase-js";
import { buildApplicationStatusUrl } from "@/lib/email/application-status-url";
import type { OnboardingEmailTemplateKey } from "@/lib/email-templates/template-keys";
import {
  createApplicantContinuationLink,
  type ContinuationReason,
} from "@/lib/onboarding/applicant-continuation-link";

export type ApplicantEmailContext = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  applicantName: string;
  applicantEmail: string;
  applicationStatusUrl: string;
  applicantPortalUrl: string;
  applicantContinuationLink: string;
  supportEmail: string;
  reason?: string;
};

export type BuildApplicantContextParams = {
  tenantId: string;
  workerId: string;
  origin: string;
  reason?: string;
  continuationReason?: ContinuationReason;
};

function formatApplicantName(first: string | null, last: string | null): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || "Applicant";
}

function resolveSupportEmail(tenantSlug: string): string {
  const configured = process.env.DEFAULT_SUPPORT_EMAIL?.trim();
  if (configured) return configured;
  const fromDomain = process.env.RESEND_FROM_EMAIL?.trim().split("@")[1];
  if (fromDomain) return `support@${fromDomain}`;
  return `support@${tenantSlug || "brasshr"}.com`;
}

export async function buildApplicantEmailContext(
  supabase: SupabaseClient,
  params: BuildApplicantContextParams
): Promise<ApplicantEmailContext | null> {
  const { data: worker, error: wErr } = await supabase
    .from("worker")
    .select("id, tenant_id, first_name, last_name, email")
    .eq("id", params.workerId)
    .maybeSingle();

  if (wErr) throw wErr;
  if (!worker?.id || !worker.email) return null;

  const tenantId = String(worker.tenant_id ?? params.tenantId);
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (tErr) throw tErr;
  if (!tenant?.slug) return null;

  const slug = String(tenant.slug);
  const applicationStatusUrl = buildApplicationStatusUrl({
    origin: params.origin,
    tenantSlug: slug,
  });
  const normalizedOrigin = params.origin.trim().replace(/\/+$/, "");
  const applicantPortalUrl = `${normalizedOrigin}/?tenant=${encodeURIComponent(slug)}`;
  const continuation = await createApplicantContinuationLink(supabase, {
    tenantId,
    workerId: String(worker.id),
    origin: params.origin,
    tenantSlug: slug,
    reason: params.continuationReason ?? "onboarding_reminder",
    markSent: true,
  });

  return {
    tenantId,
    tenantName: String(tenant.name ?? slug),
    tenantSlug: slug,
    applicantName: formatApplicantName(
      worker.first_name as string | null,
      worker.last_name as string | null
    ),
    applicantEmail: String(worker.email).trim().toLowerCase(),
    applicationStatusUrl,
    applicantPortalUrl,
    applicantContinuationLink: continuation?.url ?? applicationStatusUrl,
    supportEmail: resolveSupportEmail(slug),
    reason: params.reason?.trim() || undefined,
  };
}

export function contextToTemplateVariables(
  ctx: ApplicantEmailContext
): Record<string, string> {
  return {
    applicantName: ctx.applicantName,
    tenantName: ctx.tenantName,
    applicationStatusUrl: ctx.applicationStatusUrl,
    applicantPortalUrl: ctx.applicantPortalUrl,
    applicantContinuationLink: ctx.applicantContinuationLink,
    supportEmail: ctx.supportEmail,
    ...(ctx.reason ? { reason: ctx.reason } : {}),
  };
}

export type SendOnboardingEmailParams = {
  tenantId: string;
  workerId: string;
  templateKey: OnboardingEmailTemplateKey;
  origin: string;
  locale?: string;
  reason?: string;
  continuationReason?: ContinuationReason;
};
