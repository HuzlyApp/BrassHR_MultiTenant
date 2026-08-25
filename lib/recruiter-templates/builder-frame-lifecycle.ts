import { sanitizeESignatureUserMessage } from "@/lib/e-signature/user-facing";

export const TEMPLATE_BUILDER_INIT_TIMEOUT_MS = 45_000;

export type TemplateBuilderErrorKind =
  | "session_expired"
  | "template_missing"
  | "permission"
  | "csp_blocked"
  | "provider_unavailable"
  | "ready_timeout"
  | "network"
  | "unknown";

export const TEMPLATE_BUILDER_ERRORS: Record<TemplateBuilderErrorKind, string> = {
  session_expired: "The template-builder session expired. Refresh the session to continue.",
  template_missing: "The template could not be found. Rebuild the document to restore access.",
  permission: "You do not have permission to edit this signature template.",
  csp_blocked: "The editor was blocked by the browser’s security policy.",
  provider_unavailable: "The e-signature service is temporarily unavailable. Please try again.",
  ready_timeout: "The editor did not confirm that it was ready. Retry the connection.",
  network: "The network request failed. Check your connection and try again.",
  unknown: "The signature template editor could not be opened. Please try again.",
};

export function classifyTemplateBuilderError(
  message: string | null | undefined,
  status?: number
): TemplateBuilderErrorKind {
  const normalized = String(message ?? "").toLowerCase();

  if (status === 401 || status === 403 || normalized.includes("permission")) {
    return "permission";
  }
  if (status === 404 || normalized.includes("not found") || normalized.includes("missing")) {
    return "template_missing";
  }
  if (
    normalized.includes("expired") ||
    (normalized.includes("session") && normalized.includes("expir"))
  ) {
    return "session_expired";
  }
  if (
    normalized.includes("content security policy") ||
    normalized.includes("frame-src") ||
    normalized.includes("refused to frame") ||
    normalized.includes("blocked by")
  ) {
    return "csp_blocked";
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    (normalized.includes("timeout") && normalized.includes("script"))
  ) {
    return "network";
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("502") ||
    normalized.includes("503") ||
    normalized.includes("e-signature service")
  ) {
    return "provider_unavailable";
  }
  if (normalized.includes("did not finish loading") || normalized.includes("did not confirm")) {
    return "ready_timeout";
  }
  return "unknown";
}

export function templateBuilderUserMessage(
  message: string | null | undefined,
  status?: number,
  correlationId?: string | null
): string {
  const kind = classifyTemplateBuilderError(message, status);
  const base =
    kind === "unknown" && message?.trim()
      ? sanitizeESignatureUserMessage(message, TEMPLATE_BUILDER_ERRORS.unknown)
      : TEMPLATE_BUILDER_ERRORS[kind];
  if (!correlationId) return base;
  return `${base} (Ref: ${correlationId})`;
}

export function isBuilderSessionExpired(expiresAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!expiresAt) return true;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs <= nowMs;
}

export function msUntilSessionExpiry(expiresAt: string, nowMs = Date.now()): number {
  return new Date(expiresAt).getTime() - nowMs;
}

/**
 * Ready/timeout race guard: a stale timeout must not overwrite a successful ready state.
 */
export function applyEditorInitTimeout(args: {
  generation: number;
  activeGeneration: number;
  ready: boolean;
  cancelled: boolean;
}): { shouldSetError: boolean } {
  if (args.cancelled) return { shouldSetError: false };
  if (args.generation !== args.activeGeneration) return { shouldSetError: false };
  if (args.ready) return { shouldSetError: false };
  return { shouldSetError: true };
}

export function isAllowedTemplateBuilderMessageOrigin(
  eventOrigin: string,
  expectedOrigin: string | null
): boolean {
  if (!expectedOrigin) return false;
  return eventOrigin === expectedOrigin;
}
