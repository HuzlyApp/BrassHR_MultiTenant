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
      return "Reserved subdomain";
    case "invalid_subdomain":
    default:
      return "Invalid subdomain";
  }
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
