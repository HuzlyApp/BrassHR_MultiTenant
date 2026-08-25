/**
 * Provider-neutral copy for end users.
 * Internal Firma adapter identifiers stay in `lib/firma/*` and must never appear in UI.
 */

const PROVIDER_NAME_RE = /\b[Ff]irma(?:\.dev)?\b/g;
const PROVIDER_HOST_RE = /https?:\/\/(?:app|api)\.firma\.dev[^\s]*/gi;

export const E_SIGNATURE_LABEL = "E-Signature";
export const E_SIGNATURE_WORKSPACE_LABEL = "E-Signature Workspace";
export const E_SIGNATURE_SETTINGS_LABEL = "E-Signature Settings";
export const E_SIGNATURE_TEMPLATE_LABEL = "Signature Template";
export const E_SIGNATURE_DOCUMENT_LABEL = "E-Signature Document";
export const SIGN_DOCUMENT_LABEL = "Sign Document";
export const SEND_FOR_SIGNATURE_LABEL = "Send for Signature";
export const OPEN_SIGNING_PORTAL_LABEL = "Open Signing Portal";
export const E_SIGNATURE_SERVICE_LABEL = "e-signature service";

export type ESignatureStatusLabel =
  | "Signature Pending"
  | "Signed"
  | "Declined"
  | "Expired"
  | "Canceled"
  | "Sent"
  | "Viewed";

/** Map provider/session status values to product status labels. */
export function eSignatureStatusLabel(status: string | null | undefined): ESignatureStatusLabel {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();
  switch (normalized) {
    case "completed":
    case "signed":
    case "finished":
      return "Signed";
    case "sent":
      return "Sent";
    case "viewed":
      return "Viewed";
    case "expired":
      return "Expired";
    case "declined":
      return "Declined";
    case "cancelled":
    case "canceled":
    case "voided":
      return "Canceled";
    default:
      return "Signature Pending";
  }
}

/**
 * Strip provider names/hosts from messages that may reach applicants, workers, or admins.
 * Prefer mapping to a known message when the input is empty or only provider noise.
 */
export function sanitizeESignatureUserMessage(
  message: string | null | undefined,
  fallback = "The e-signature service is temporarily unavailable. Please try again."
): string {
  const raw = String(message ?? "").trim();
  if (!raw) return fallback;

  let next = raw
    .replace(PROVIDER_HOST_RE, "the e-signature service")
    .replace(PROVIDER_NAME_RE, "e-signature")
    .replace(/\bFIRMA_[A-Z0-9_]+\b/g, "e-signature configuration")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Capitalize after replacements like "e-signature workspace..."
  next = next.replace(/^e-signature\b/i, (match) =>
    match[0] === "E" ? match : "E-signature"
  );

  // Common phrasing cleanup after naive replacement
  next = next
    .replace(/\be-signature\.dev\b/gi, "e-signature service")
    .replace(/\bE-signature\.dev\b/g, "E-signature service")
    .replace(/\bCreate e-signature workspace\b/gi, "Create E-Signature Workspace")
    .replace(/\bFirma workspace\b/gi, "E-Signature Workspace");

  if (!next || /^e-signature\.?$/i.test(next)) return fallback;
  return next;
}

export const E_SIGNATURE_USER_ERRORS = {
  workspaceUnavailable:
    "Unable to create the e-signature workspace.",
  sendFailed: "Unable to send this document for signature.",
  sessionOpenFailed: "The signing session could not be opened.",
  serviceUnavailable:
    "The e-signature service is temporarily unavailable. Please try again.",
  statusUnavailable: "We could not retrieve the latest signature status.",
  templateMissing:
    "Signing is not configured yet. Your recruiter must attach a published signature template to this step.",
  templateNotPublished: "Publish the signature template before applicants can sign.",
  workspaceNotConfigured:
    "No e-signature workspace is configured for this organization. Create a workspace below or ask your platform administrator for help.",
  connectionFailed: "E-signature service connection failed.",
} as const;
