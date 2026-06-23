import type { SupabaseClient } from "@supabase/supabase-js";
import { FirmaError } from "@/lib/firma/errors";
import {
  createFirmaSigningRequest,
  getFirmaSigningRequest,
  getFirmaTemplate,
  isFirmaConfigured,
  resolveApplicantSigningRecipient,
  resolveFirmaRecipientSigningUrl,
} from "@/lib/firma/client";
import {
  getFirmaRecruiterTemplateId,
  isFirmaSigningComplete,
  mapFirmaStatusToOnboardingStatus,
  normalizeFirmaSigningStatus,
} from "@/lib/onboarding/firma-step-settings";
import { DRAFT_PREVIEW_APPLICANT_EMAIL } from "@/lib/onboarding/is-draft-preview";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";

export type WorkerFirmaSigningSessionRow = {
  id: string;
  tenant_id: string;
  worker_id: string;
  onboarding_step_id: string;
  recruiter_template_id: string | null;
  firma_template_id: string | null;
  signing_request_id: string;
  signing_request_user_id: string | null;
  firma_status: string;
  iframe_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FirmaSigningSessionPayload = {
  signing_request_id: string;
  signing_request_user_id: string | null;
  iframe_url: string | null;
  firma_status: string;
  onboarding_status: OnboardingStepStatus;
  step_key: string;
  step_title: string;
  recruiter_template_id: string | null;
  firma_template_id: string | null;
};

export type EnsureFirmaSigningSessionInput = {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicantEmail: string;
  applicantFirstName: string;
  applicantLastName?: string | null;
  step: TenantOnboardingStep;
};

export type EnsureFirmaDraftPreviewSigningSessionInput = {
  supabase: SupabaseClient;
  tenantId: string;
  step: TenantOnboardingStep;
  applicantEmail?: string;
  applicantFirstName?: string;
  applicantLastName?: string | null;
};

function isFirmaWorkspaceMismatchMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("does not belong to this workspace") ||
    normalized.includes("invalid_template")
  );
}

export function mapFirmaSigningCreateError(err: unknown): FirmaOnboardingSigningError {
  if (err instanceof FirmaOnboardingSigningError) return err;
  if (err instanceof FirmaError) {
    if (err.code === "NOT_FOUND" || isFirmaWorkspaceMismatchMessage(err.message)) {
      return new FirmaOnboardingSigningError(
        "The attached Firma template is not available in this server workspace. Open Template Builder, re-open the template (or use force recreate), publish again, then retry onboarding.",
        "TEMPLATE_WORKSPACE_MISMATCH",
        409
      );
    }
    return new FirmaOnboardingSigningError(err.message, "CREATE_FAILED", err.status);
  }
  const message = err instanceof Error ? err.message : "Failed to create Firma signing request";
  if (isFirmaWorkspaceMismatchMessage(message)) {
    return new FirmaOnboardingSigningError(
      "The attached Firma template is not available in this server workspace. Open Template Builder, re-open the template (or use force recreate), publish again, then retry onboarding.",
      "TEMPLATE_WORKSPACE_MISMATCH",
      409
    );
  }
  return new FirmaOnboardingSigningError(message, "CREATE_FAILED", 500);
}

export class FirmaOnboardingSigningError extends Error {
  constructor(
    message: string,
    readonly code:
      | "MISSING_TEMPLATE"
      | "TEMPLATE_NOT_PUBLISHED"
      | "TEMPLATE_WORKSPACE_MISMATCH"
      | "FIRMA_NOT_CONFIGURED"
      | "CREATE_FAILED"
      | "INVALID_SESSION"
      | "IFRAME_UNAVAILABLE",
    readonly status = 400
  ) {
    super(message);
    this.name = "FirmaOnboardingSigningError";
  }
}

async function loadRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  recruiterTemplateId: string
) {
  const { data, error } = await supabase
    .from("recruiter_templates")
    .select("id, tenant_id, name, status, firma_template_id")
    .eq("id", recruiterTemplateId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadExistingSession(
  supabase: SupabaseClient,
  workerId: string,
  onboardingStepId: string
): Promise<WorkerFirmaSigningSessionRow | null> {
  const { data, error } = await supabase
    .from("worker_firma_signing_sessions")
    .select("*")
    .eq("worker_id", workerId)
    .eq("onboarding_step_id", onboardingStepId)
    .maybeSingle();

  if (error) throw error;
  return (data as WorkerFirmaSigningSessionRow | null) ?? null;
}

async function upsertSession(
  supabase: SupabaseClient,
  row: Omit<WorkerFirmaSigningSessionRow, "created_at" | "updated_at" | "id"> & { id?: string }
): Promise<WorkerFirmaSigningSessionRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("worker_firma_signing_sessions")
    .upsert(
      {
        ...row,
        updated_at: now,
      },
      { onConflict: "worker_id,onboarding_step_id" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new FirmaOnboardingSigningError("Failed to save signing session", "CREATE_FAILED", 500);
  }
  return data as WorkerFirmaSigningSessionRow;
}

function sessionPayloadFromFirma(
  step: TenantOnboardingStep,
  detail: {
    signing_request_id: string;
    signing_request_user_id: string | null;
    iframe_url: string | null;
    firma_status: string;
    recruiter_template_id: string | null;
    firma_template_id: string | null;
  }
): FirmaSigningSessionPayload {
  return {
    signing_request_id: detail.signing_request_id,
    signing_request_user_id: detail.signing_request_user_id,
    iframe_url: detail.iframe_url,
    firma_status: normalizeFirmaSigningStatus(detail.firma_status),
    onboarding_status: mapFirmaStatusToOnboardingStatus(detail.firma_status),
    step_key: step.step_key,
    step_title: step.title,
    recruiter_template_id: detail.recruiter_template_id,
    firma_template_id: detail.firma_template_id,
  };
}

async function resolveRecruiterTemplateForStep(
  supabase: SupabaseClient,
  tenantId: string,
  step: TenantOnboardingStep
) {
  const recruiterTemplateId = getFirmaRecruiterTemplateId(step);
  if (!recruiterTemplateId) {
    throw new FirmaOnboardingSigningError(
      "This onboarding step does not have a Firma template attached",
      "MISSING_TEMPLATE",
      400
    );
  }

  if (!isFirmaConfigured()) {
    throw new FirmaOnboardingSigningError("Firma API is not configured", "FIRMA_NOT_CONFIGURED", 503);
  }

  const recruiterTemplate = await loadRecruiterTemplate(supabase, tenantId, recruiterTemplateId);
  if (!recruiterTemplate?.id) {
    throw new FirmaOnboardingSigningError("Firma template not found", "MISSING_TEMPLATE", 404);
  }
  if (recruiterTemplate.status !== "active" || !recruiterTemplate.firma_template_id) {
    throw new FirmaOnboardingSigningError(
      "Publish the Firma template before applicants can sign",
      "TEMPLATE_NOT_PUBLISHED",
      400
    );
  }

  return { recruiterTemplateId, recruiterTemplate };
}

async function createFirmaSigningSessionFromTemplate(
  input: {
    applicantEmail: string;
    applicantFirstName: string;
    applicantLastName?: string | null;
  },
  recruiterTemplateId: string,
  firmaTemplateId: string,
  templateName: string
) {
  const detail = await createFirmaSigningRequest({
    template_id: firmaTemplateId,
    name: `${templateName} — ${input.applicantFirstName}`.trim(),
    recipients: [
      {
        first_name: input.applicantFirstName,
        last_name: input.applicantLastName?.trim() || undefined,
        email: input.applicantEmail.trim().toLowerCase(),
        designation: "Signer",
        order: 1,
      },
    ],
  });

  const recipient = resolveApplicantSigningRecipient(detail, input.applicantEmail);
  const iframeUrl = resolveFirmaRecipientSigningUrl(recipient);
  if (!iframeUrl) {
    throw new FirmaOnboardingSigningError(
      "Firma did not return a signing URL for this applicant",
      "IFRAME_UNAVAILABLE",
      502
    );
  }

  return {
    detail,
    recipient,
    iframeUrl,
    firmaStatus: normalizeFirmaSigningStatus(detail.status ?? recipient?.status),
  };
}

export async function ensureFirmaDraftPreviewSigningSession(
  input: EnsureFirmaDraftPreviewSigningSessionInput
): Promise<FirmaSigningSessionPayload> {
  const { recruiterTemplateId, recruiterTemplate } = await resolveRecruiterTemplateForStep(
    input.supabase,
    input.tenantId,
    input.step
  );

  const applicantEmail = input.applicantEmail?.trim() || DRAFT_PREVIEW_APPLICANT_EMAIL;
  const applicantFirstName = input.applicantFirstName?.trim() || "Draft Preview";

  try {
    await getFirmaTemplate(String(recruiterTemplate.firma_template_id));
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }

  try {
    const created = await createFirmaSigningSessionFromTemplate(
      {
        applicantEmail,
        applicantFirstName,
        applicantLastName: input.applicantLastName,
      },
      recruiterTemplateId,
      String(recruiterTemplate.firma_template_id),
      recruiterTemplate.name ?? input.step.title
    );

    return sessionPayloadFromFirma(input.step, {
      signing_request_id: created.detail.id,
      signing_request_user_id: created.recipient?.id ?? null,
      iframe_url: created.iframeUrl,
      firma_status: created.firmaStatus,
      recruiter_template_id: recruiterTemplateId,
      firma_template_id: String(recruiterTemplate.firma_template_id),
    });
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }
}

function sessionPayload(
  step: TenantOnboardingStep,
  session: WorkerFirmaSigningSessionRow
): FirmaSigningSessionPayload {
  return {
    signing_request_id: session.signing_request_id,
    signing_request_user_id: session.signing_request_user_id,
    iframe_url: session.iframe_url,
    firma_status: normalizeFirmaSigningStatus(session.firma_status),
    onboarding_status: mapFirmaStatusToOnboardingStatus(session.firma_status),
    step_key: step.step_key,
    step_title: step.title,
    recruiter_template_id: session.recruiter_template_id,
    firma_template_id: session.firma_template_id,
  };
}

async function refreshSessionFromFirma(
  supabase: SupabaseClient,
  step: TenantOnboardingStep,
  session: WorkerFirmaSigningSessionRow,
  applicantEmail: string
): Promise<WorkerFirmaSigningSessionRow> {
  const detail = await getFirmaSigningRequest(session.signing_request_id);
  const recipient = resolveApplicantSigningRecipient(detail, applicantEmail);
  const iframeUrl = resolveFirmaRecipientSigningUrl(recipient);
  const firmaStatus = normalizeFirmaSigningStatus(
    detail.status ?? recipient?.status ?? session.firma_status
  );

  return upsertSession(supabase, {
    id: session.id,
    tenant_id: session.tenant_id,
    worker_id: session.worker_id,
    onboarding_step_id: session.onboarding_step_id,
    recruiter_template_id: session.recruiter_template_id,
    firma_template_id: session.firma_template_id,
    signing_request_id: session.signing_request_id,
    signing_request_user_id: recipient?.id ?? session.signing_request_user_id,
    firma_status: firmaStatus,
    iframe_url: iframeUrl,
  });
}

async function createSessionFromTemplate(
  supabase: SupabaseClient,
  input: EnsureFirmaSigningSessionInput,
  recruiterTemplateId: string,
  firmaTemplateId: string,
  templateName: string
): Promise<WorkerFirmaSigningSessionRow> {
  const created = await createFirmaSigningSessionFromTemplate(
    input,
    recruiterTemplateId,
    firmaTemplateId,
    templateName
  );

  return upsertSession(supabase, {
    tenant_id: input.tenantId,
    worker_id: input.workerId,
    onboarding_step_id: input.step.id,
    recruiter_template_id: recruiterTemplateId,
    firma_template_id: firmaTemplateId,
    signing_request_id: created.detail.id,
    signing_request_user_id: created.recipient?.id ?? null,
    firma_status: created.firmaStatus,
    iframe_url: created.iframeUrl,
  });
}

export async function ensureFirmaSigningSession(
  input: EnsureFirmaSigningSessionInput
): Promise<FirmaSigningSessionPayload> {
  const { recruiterTemplateId, recruiterTemplate } = await resolveRecruiterTemplateForStep(
    input.supabase,
    input.tenantId,
    input.step
  );

  const existing = await loadExistingSession(input.supabase, input.workerId, input.step.id);
  if (existing?.signing_request_id) {
    try {
      const refreshed = await refreshSessionFromFirma(
        input.supabase,
        input.step,
        existing,
        input.applicantEmail
      );
      if (!refreshed.iframe_url) {
        throw new FirmaOnboardingSigningError(
          "Signing session is missing an embed URL",
          "IFRAME_UNAVAILABLE",
          502
        );
      }
      return sessionPayload(input.step, refreshed);
    } catch (err) {
      if (err instanceof FirmaError && err.code === "NOT_FOUND") {
        throw new FirmaOnboardingSigningError(
          "The Firma signing request is no longer valid",
          "INVALID_SESSION",
          410
        );
      }
      throw err;
    }
  }

  try {
    await getFirmaTemplate(String(recruiterTemplate.firma_template_id));
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }

  try {
    const created = await createSessionFromTemplate(
      input.supabase,
      input,
      recruiterTemplateId,
      String(recruiterTemplate.firma_template_id),
      recruiterTemplate.name ?? input.step.title
    );
    return sessionPayload(input.step, created);
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }
}

export async function syncFirmaSigningSessionStatus(
  input: EnsureFirmaSigningSessionInput
): Promise<FirmaSigningSessionPayload> {
  const existing = await loadExistingSession(input.supabase, input.workerId, input.step.id);
  if (!existing?.signing_request_id) {
    throw new FirmaOnboardingSigningError("Signing session not found", "INVALID_SESSION", 404);
  }

  try {
    const refreshed = await refreshSessionFromFirma(
      input.supabase,
      input.step,
      existing,
      input.applicantEmail
    );
    return sessionPayload(input.step, refreshed);
  } catch (err) {
    if (err instanceof FirmaError && err.code === "NOT_FOUND") {
      throw new FirmaOnboardingSigningError(
        "The Firma signing request is no longer valid",
        "INVALID_SESSION",
        410
      );
    }
    throw err;
  }
}

export function shouldCompleteOnboardingStepFromFirmaStatus(
  firmaStatus: string | null | undefined
): boolean {
  return isFirmaSigningComplete(firmaStatus);
}
