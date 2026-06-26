import type { SupabaseClient } from "@supabase/supabase-js";
import { FirmaError } from "@/lib/firma/errors";
import {
  createAndSendFirmaSigningRequest,
  getFirmaSigningRequest,
  getFirmaSigningRequestUsers,
  getFirmaTemplate,
  isFirmaConfigured,
  resolveApplicantSigningRecipient,
  resolveFirmaSigningIframeUrl,
} from "@/lib/firma/client";
import {
  FirmaWorkspaceConfigError,
  isStoredFirmaWorkspaceMismatch,
  resolveTenantFirmaWorkspaceId,
} from "@/lib/firma/resolve-tenant-workspace";
import {
  getFirmaSigningSessionStaleReason,
  isFirmaSigningSessionStale,
} from "@/lib/firma/session-staleness";
import {
  getFirmaRecruiterTemplateId,
  isFirmaSigningComplete,
  mapFirmaStatusToOnboardingStatus,
  normalizeFirmaSigningStatus,
} from "@/lib/onboarding/firma-step-settings";
import {
  DRAFT_PREVIEW_APPLICANT_EMAIL,
  getDraftPreviewFirmaSignerEmailFallback,
  isUndeliverableDraftPreviewEmail,
  resolveDraftPreviewFirmaSignerEmail,
} from "@/lib/onboarding/is-draft-preview";
import { isValidStep1Email } from "@/lib/onboardingStep1Validation";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";

export type WorkerFirmaSigningSessionRow = {
  id: string;
  tenant_id: string;
  worker_id: string;
  onboarding_step_id: string;
  recruiter_template_id: string | null;
  firma_template_id: string | null;
  firma_workspace_id: string | null;
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

function isFirmaEmailBounceError(err: unknown): boolean {
  const message =
    err instanceof FirmaError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
  return /bounce|can't receive email|cannot receive email/i.test(message);
}

function isFirmaWorkspaceMismatchMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("does not belong to this workspace") ||
    normalized.includes("invalid_template") ||
    normalized.includes("workspace mismatch")
  );
}

export function mapFirmaSigningCreateError(err: unknown): FirmaOnboardingSigningError {
  if (err instanceof FirmaOnboardingSigningError) return err;
  if (err instanceof FirmaWorkspaceConfigError) {
    return new FirmaOnboardingSigningError(err.message, "WORKSPACE_NOT_CONFIGURED", err.status);
  }
  if (err instanceof FirmaError) {
    if (err.code === "NOT_FOUND" || isFirmaWorkspaceMismatchMessage(err.message)) {
      return new FirmaOnboardingSigningError(
        "The attached Firma template is not available in this organization's Firma workspace. Open Template Builder, re-open the template (or use force recreate), publish again, then retry onboarding.",
        "TEMPLATE_WORKSPACE_MISMATCH",
        409
      );
    }
    if (err.code === "AUTH_ERROR") {
      return new FirmaOnboardingSigningError(
        "Firma API credentials do not have access to this organization's workspace. Verify the Firma API key and workspace ID configuration.",
        "FIRMA_AUTH_MISMATCH",
        err.status
      );
    }
    return new FirmaOnboardingSigningError(err.message, "CREATE_FAILED", err.status);
  }
  const message = err instanceof Error ? err.message : "Failed to create Firma signing request";
  if (isFirmaWorkspaceMismatchMessage(message)) {
    return new FirmaOnboardingSigningError(
      "The attached Firma template is not available in this organization's Firma workspace. Open Template Builder, re-open the template (or use force recreate), publish again, then retry onboarding.",
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
      | "SESSION_WORKSPACE_MISMATCH"
      | "WORKSPACE_NOT_CONFIGURED"
      | "FIRMA_AUTH_MISMATCH"
      | "FIRMA_NOT_CONFIGURED"
      | "CREATE_FAILED"
      | "INVALID_SESSION"
      | "SIGNING_REQUEST_DRAFT"
      | "IFRAME_UNAVAILABLE"
      | "INVALID_APPLICANT_EMAIL",
    readonly status = 400
  ) {
    super(message);
    this.name = "FirmaOnboardingSigningError";
  }
}

export function assertValidApplicantEmailForSigning(email: string): void {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new FirmaOnboardingSigningError(
      "Applicant email is required before creating a signing request. Complete the first onboarding step with a valid email.",
      "INVALID_APPLICANT_EMAIL",
      400
    );
  }
  if (!isValidStep1Email(trimmed)) {
    throw new FirmaOnboardingSigningError(
      "Enter a valid applicant email before creating a signing request.",
      "INVALID_APPLICANT_EMAIL",
      400
    );
  }
}

async function resolveWorkspaceForSigning(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  try {
    return await resolveTenantFirmaWorkspaceId(supabase, tenantId);
  } catch (err) {
    if (err instanceof FirmaWorkspaceConfigError) {
      throw new FirmaOnboardingSigningError(err.message, "WORKSPACE_NOT_CONFIGURED", err.status);
    }
    throw err;
  }
}

async function loadRecruiterTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  recruiterTemplateId: string
) {
  const { data, error } = await supabase
    .from("recruiter_templates")
    .select("id, tenant_id, name, status, firma_template_id, firma_workspace_id")
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

async function clearSigningSession(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const { error } = await supabase.from("worker_firma_signing_sessions").delete().eq("id", sessionId);
  if (error) throw error;
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
  step: TenantOnboardingStep,
  workspaceId: string
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

  if (isStoredFirmaWorkspaceMismatch(recruiterTemplate.firma_workspace_id, workspaceId)) {
    throw new FirmaOnboardingSigningError(
      "This template belongs to a different Firma workspace. Re-publish the template in Template Builder before applicants can sign.",
      "TEMPLATE_WORKSPACE_MISMATCH",
      409
    );
  }

  return { recruiterTemplateId, recruiterTemplate };
}

function assertSigningRequestIsEmbeddable(firmaStatus: string): void {
  const status = normalizeFirmaSigningStatus(firmaStatus);
  if (status === "draft") {
    throw new FirmaOnboardingSigningError(
      "The Firma signing request has not been sent yet. A new signing request will be created.",
      "SIGNING_REQUEST_DRAFT",
      409
    );
  }
}

async function createFirmaSigningSessionFromTemplate(
  input: {
    applicantEmail: string;
    applicantFirstName: string;
    applicantLastName?: string | null;
  },
  firmaTemplateId: string,
  templateName: string,
  workspaceId: string
) {
  const detail = await createAndSendFirmaSigningRequest(
    {
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
    },
    workspaceId
  );

  const firmaStatus = normalizeFirmaSigningStatus(detail.status);
  assertSigningRequestIsEmbeddable(firmaStatus);

  const recipient = resolveApplicantSigningRecipient(detail, input.applicantEmail);
  const iframeUrl = resolveFirmaSigningIframeUrl(recipient);
  if (!iframeUrl) {
    throw new FirmaOnboardingSigningError(
      "Firma did not return a signing URL for this applicant. The signing request may not have been sent successfully.",
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
  const workspaceId = await resolveWorkspaceForSigning(input.supabase, input.tenantId);
  const { recruiterTemplateId, recruiterTemplate } = await resolveRecruiterTemplateForStep(
    input.supabase,
    input.tenantId,
    input.step,
    workspaceId
  );

  const primaryEmail = input.applicantEmail?.trim() || DRAFT_PREVIEW_APPLICANT_EMAIL;
  const fallbackEmail = getDraftPreviewFirmaSignerEmailFallback();
  let signerEmail = resolveDraftPreviewFirmaSignerEmail(primaryEmail);
  const applicantFirstName = input.applicantFirstName?.trim() || "Draft Preview";

  try {
    await getFirmaTemplate(String(recruiterTemplate.firma_template_id), workspaceId);
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }

  const createSession = async (applicantEmail: string) => {
    const created = await createFirmaSigningSessionFromTemplate(
      {
        applicantEmail,
        applicantFirstName,
        applicantLastName: input.applicantLastName,
      },
      String(recruiterTemplate.firma_template_id),
      recruiterTemplate.name ?? input.step.title,
      workspaceId
    );

    return sessionPayloadFromFirma(input.step, {
      signing_request_id: created.detail.id,
      signing_request_user_id: created.recipient?.id ?? null,
      iframe_url: created.iframeUrl,
      firma_status: created.firmaStatus,
      recruiter_template_id: recruiterTemplateId,
      firma_template_id: String(recruiterTemplate.firma_template_id),
    });
  };

  try {
    return await createSession(signerEmail);
  } catch (err) {
    if (
      signerEmail !== fallbackEmail &&
      !isUndeliverableDraftPreviewEmail(signerEmail) &&
      isFirmaEmailBounceError(err)
    ) {
      signerEmail = fallbackEmail;
      try {
        return await createSession(fallbackEmail);
      } catch (retryErr) {
        throw mapFirmaSigningCreateError(retryErr);
      }
    }
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
  applicantEmail: string,
  workspaceId: string,
  expected: {
    recruiterTemplateId: string;
    firmaTemplateId: string;
  }
): Promise<WorkerFirmaSigningSessionRow> {
  const detail = await getFirmaSigningRequest(session.signing_request_id, workspaceId);
  const users =
    Array.isArray(detail.recipients) && detail.recipients.length > 0
      ? detail.recipients
      : await getFirmaSigningRequestUsers(session.signing_request_id, workspaceId);
  const recipient = resolveApplicantSigningRecipient(detail, applicantEmail, users);
  const iframeUrl = resolveFirmaSigningIframeUrl(recipient, session.signing_request_user_id);
  const firmaStatus = normalizeFirmaSigningStatus(
    detail.status ?? recipient?.status ?? session.firma_status
  );

  if (
    isFirmaSigningSessionStale({
      firmaStatus,
      storedWorkspaceId: session.firma_workspace_id,
      effectiveWorkspaceId: workspaceId,
      recruiterTemplateId: session.recruiter_template_id,
      expectedRecruiterTemplateId: expected.recruiterTemplateId,
      firmaTemplateId: session.firma_template_id,
      expectedFirmaTemplateId: expected.firmaTemplateId,
    })
  ) {
    throw new FirmaOnboardingSigningError(
      "The stored Firma signing session is no longer valid",
      "INVALID_SESSION",
      410
    );
  }

  if (!iframeUrl) {
    throw new FirmaOnboardingSigningError(
      "Firma did not return a signing URL for this applicant",
      "IFRAME_UNAVAILABLE",
      502
    );
  }

  return upsertSession(supabase, {
    id: session.id,
    tenant_id: session.tenant_id,
    worker_id: session.worker_id,
    onboarding_step_id: session.onboarding_step_id,
    recruiter_template_id: session.recruiter_template_id,
    firma_template_id: session.firma_template_id,
    firma_workspace_id: workspaceId,
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
  templateName: string,
  workspaceId: string
): Promise<WorkerFirmaSigningSessionRow> {
  const created = await createFirmaSigningSessionFromTemplate(
    input,
    firmaTemplateId,
    templateName,
    workspaceId
  );

  return upsertSession(supabase, {
    tenant_id: input.tenantId,
    worker_id: input.workerId,
    onboarding_step_id: input.step.id,
    recruiter_template_id: recruiterTemplateId,
    firma_template_id: firmaTemplateId,
    firma_workspace_id: workspaceId,
    signing_request_id: created.detail.id,
    signing_request_user_id: created.recipient?.id ?? null,
    firma_status: created.firmaStatus,
    iframe_url: created.iframeUrl,
  });
}

function shouldDiscardExistingSession(
  session: WorkerFirmaSigningSessionRow,
  workspaceId: string,
  recruiterTemplateId: string,
  firmaTemplateId: string
): boolean {
  return isFirmaSigningSessionStale({
    firmaStatus: session.firma_status,
    storedWorkspaceId: session.firma_workspace_id,
    effectiveWorkspaceId: workspaceId,
    recruiterTemplateId: session.recruiter_template_id,
    expectedRecruiterTemplateId: recruiterTemplateId,
    firmaTemplateId: session.firma_template_id,
    expectedFirmaTemplateId: firmaTemplateId,
  });
}

export async function ensureFirmaSigningSession(
  input: EnsureFirmaSigningSessionInput
): Promise<FirmaSigningSessionPayload> {
  assertValidApplicantEmailForSigning(input.applicantEmail);
  const workspaceId = await resolveWorkspaceForSigning(input.supabase, input.tenantId);
  const { recruiterTemplateId, recruiterTemplate } = await resolveRecruiterTemplateForStep(
    input.supabase,
    input.tenantId,
    input.step,
    workspaceId
  );
  const firmaTemplateId = String(recruiterTemplate.firma_template_id);

  const existing = await loadExistingSession(input.supabase, input.workerId, input.step.id);
  if (existing?.signing_request_id) {
    if (shouldDiscardExistingSession(existing, workspaceId, recruiterTemplateId, firmaTemplateId)) {
      await clearSigningSession(input.supabase, existing.id);
    } else {
      try {
        const refreshed = await refreshSessionFromFirma(
          input.supabase,
          input.step,
          existing,
          input.applicantEmail,
          workspaceId,
          { recruiterTemplateId, firmaTemplateId }
        );
        return sessionPayload(input.step, refreshed);
      } catch (err) {
        if (
          err instanceof FirmaOnboardingSigningError &&
          (err.code === "INVALID_SESSION" ||
            err.code === "IFRAME_UNAVAILABLE" ||
            err.code === "SIGNING_REQUEST_DRAFT")
        ) {
          await clearSigningSession(input.supabase, existing.id);
        } else if (err instanceof FirmaError && err.code === "NOT_FOUND") {
          await clearSigningSession(input.supabase, existing.id);
        } else if (err instanceof FirmaOnboardingSigningError && err.code === "SESSION_WORKSPACE_MISMATCH") {
          await clearSigningSession(input.supabase, existing.id);
        } else {
          throw err;
        }
      }
    }
  }

  try {
    await getFirmaTemplate(firmaTemplateId, workspaceId);
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }

  try {
    const created = await createSessionFromTemplate(
      input.supabase,
      input,
      recruiterTemplateId,
      firmaTemplateId,
      recruiterTemplate.name ?? input.step.title,
      workspaceId
    );
    return sessionPayload(input.step, created);
  } catch (err) {
    throw mapFirmaSigningCreateError(err);
  }
}

export async function syncFirmaSigningSessionStatus(
  input: EnsureFirmaSigningSessionInput
): Promise<FirmaSigningSessionPayload> {
  assertValidApplicantEmailForSigning(input.applicantEmail);
  const workspaceId = await resolveWorkspaceForSigning(input.supabase, input.tenantId);
  const recruiterTemplateId = getFirmaRecruiterTemplateId(input.step);
  const existing = await loadExistingSession(input.supabase, input.workerId, input.step.id);
  if (!existing?.signing_request_id) {
    throw new FirmaOnboardingSigningError("Signing session not found", "INVALID_SESSION", 404);
  }

  if (isStoredFirmaWorkspaceMismatch(existing.firma_workspace_id, workspaceId)) {
    throw new FirmaOnboardingSigningError(
      "This signing session belongs to a different Firma workspace",
      "SESSION_WORKSPACE_MISMATCH",
      409
    );
  }

  try {
    const refreshed = await refreshSessionFromFirma(
      input.supabase,
      input.step,
      existing,
      input.applicantEmail,
      workspaceId,
      {
        recruiterTemplateId: recruiterTemplateId ?? existing.recruiter_template_id ?? "",
        firmaTemplateId: existing.firma_template_id ?? "",
      }
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

/** Poll Firma for signing status without a persisted worker session (draft preview). */
export async function syncFirmaSigningStatusByRequestId(input: {
  signingRequestId: string;
  applicantEmail: string;
  step: TenantOnboardingStep;
  tenantId: string;
  supabase: SupabaseClient;
  workspaceId?: string;
}): Promise<FirmaSigningSessionPayload> {
  if (!isFirmaConfigured()) {
    throw new FirmaOnboardingSigningError("Firma API is not configured", "FIRMA_NOT_CONFIGURED", 503);
  }

  const workspaceId =
    input.workspaceId ?? (await resolveWorkspaceForSigning(input.supabase, input.tenantId));

  try {
    const detail = await getFirmaSigningRequest(input.signingRequestId, workspaceId);
    const users =
      Array.isArray(detail.recipients) && detail.recipients.length > 0
        ? detail.recipients
        : await getFirmaSigningRequestUsers(input.signingRequestId, workspaceId);
    const recipient = resolveApplicantSigningRecipient(detail, input.applicantEmail, users);
    const iframeUrl = resolveFirmaSigningIframeUrl(recipient, recipient?.id ?? null);
    const firmaStatus = normalizeFirmaSigningStatus(
      detail.status ?? recipient?.status ?? "draft"
    );

    return sessionPayloadFromFirma(input.step, {
      signing_request_id: input.signingRequestId,
      signing_request_user_id: recipient?.id ?? null,
      iframe_url: iframeUrl,
      firma_status: firmaStatus,
      recruiter_template_id: getFirmaRecruiterTemplateId(input.step),
      firma_template_id: null,
    });
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

export { getFirmaSigningSessionStaleReason, isFirmaSigningSessionStale };
