/**
 * DNS label validation for *.ROOT_DOMAIN (server + client shared).
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "dashboard",
  "hr",
  "mail",
  "support",
]);

export type SubdomainValidationFailure =
  | "invalid_subdomain"
  | "reserved_subdomain";

/** Human-readable reasons matching product requirements */
export function subdomainErrorMessage(kind: SubdomainValidationFailure): string {
  switch (kind) {
    case "reserved_subdomain":
      return "This domain name is reserved. Please choose another.";
    case "invalid_subdomain":
    default:
      return "Domain must be 3–63 letters or numbers (hyphens allowed, not at the ends).";
  }
}

/** Client field error for the domain onboarding input (empty + format). */
export function subdomainFieldErrorMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Please enter a domain name.";
  }
  const parsed = validateTenantSubdomainInput(trimmed);
  if ("failure" in parsed) {
    return subdomainErrorMessage(parsed.failure);
  }
  return null;
}

export function isSubdomainOnboardingApiError(payload: {
  error?: string;
  code?: string;
}): boolean {
  if (payload.code === "invalid_subdomain" || payload.code === "reserved_subdomain") {
    return true;
  }
  const message = String(payload.error ?? "").toLowerCase();
  return message.includes("subdomain") || message.includes("domain");
}

const LABEL_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Validates a raw subdomain input string (already trimmed externally is OK).
 */
export function validateTenantSubdomainInput(raw: string): { subdomain: string } | { failure: SubdomainValidationFailure } {
  const subdomain = raw.trim().toLowerCase();
  if (subdomain.length < 3 || subdomain.length > 63) {
    return { failure: "invalid_subdomain" };
  }
  if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
    return { failure: "invalid_subdomain" };
  }
  if (!LABEL_RE.test(subdomain) || subdomain.includes(" ")) {
    return { failure: "invalid_subdomain" };
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return { failure: "reserved_subdomain" };
  }
  return { subdomain };
}
