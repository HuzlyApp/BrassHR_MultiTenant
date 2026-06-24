import { normalizeFirmaSigningStatus } from "@/lib/onboarding/firma-step-settings";
import { isStoredFirmaWorkspaceMismatch } from "@/lib/firma/resolve-tenant-workspace";

const TERMINAL_FIRMA_SIGNING_STATUSES = new Set([
  "completed",
  "signed",
  "expired",
  "cancelled",
  "voided",
]);

export type FirmaSigningSessionStaleReason =
  | "not_found"
  | "workspace_mismatch"
  | "terminal_status"
  | "draft_not_sent"
  | "template_changed";

export function getFirmaSigningSessionStaleReason(input: {
  firmaStatus?: string | null;
  storedWorkspaceId?: string | null;
  effectiveWorkspaceId: string;
  notFound?: boolean;
  recruiterTemplateId?: string | null;
  expectedRecruiterTemplateId?: string | null;
  firmaTemplateId?: string | null;
  expectedFirmaTemplateId?: string | null;
}): FirmaSigningSessionStaleReason | null {
  if (input.notFound) return "not_found";

  if (isStoredFirmaWorkspaceMismatch(input.storedWorkspaceId, input.effectiveWorkspaceId)) {
    return "workspace_mismatch";
  }

  if (
    input.expectedRecruiterTemplateId &&
    input.recruiterTemplateId &&
    input.recruiterTemplateId !== input.expectedRecruiterTemplateId
  ) {
    return "template_changed";
  }

  if (
    input.expectedFirmaTemplateId &&
    input.firmaTemplateId &&
    input.firmaTemplateId !== input.expectedFirmaTemplateId
  ) {
    return "template_changed";
  }

  const status = normalizeFirmaSigningStatus(input.firmaStatus ?? "draft");
  if (TERMINAL_FIRMA_SIGNING_STATUSES.has(status)) return "terminal_status";
  if (status === "draft") return "draft_not_sent";

  return null;
}

export function isFirmaSigningSessionStale(
  input: Parameters<typeof getFirmaSigningSessionStaleReason>[0]
): boolean {
  return getFirmaSigningSessionStaleReason(input) !== null;
}

export function staleFirmaSigningSessionMessage(reason: FirmaSigningSessionStaleReason): string {
  switch (reason) {
    case "not_found":
      return "The previous Firma signing request is no longer available. A new signing request will be created.";
    case "workspace_mismatch":
      return "This signing session belongs to a different Firma workspace. A new signing request will be created in your organization's workspace.";
    case "terminal_status":
      return "The previous Firma signing request is already finished. A new signing request will be created if you need to sign again.";
    case "draft_not_sent":
      return "The previous Firma signing request was never sent. A new signing request will be created.";
    case "template_changed":
      return "The onboarding template changed since the last signing session. A new signing request will be created.";
    default:
      return "The previous signing session is no longer valid. A new signing request will be created.";
  }
}
