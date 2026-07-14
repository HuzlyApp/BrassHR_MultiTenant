import { normalizePublicOrigin } from "@/lib/resolve-app-origin";
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";
import { buildTenantVanityOrigin } from "@/lib/tenant/tenant-vanity-url";

function isLocalDevHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host === "[::1]" ||
    host === "::1"
  );
}

/**
 * Public origin used in applicant email links.
 * Production / staging: `{tenant}.{ROOT_DOMAIN}` 
 * Localhost: keep the provided origin so `?tenant=` still works in local flows.
 */
export function resolveApplicantEmailOrigin(
  origin: string,
  tenantLabel: string,
  options?: { rootDomain?: string }
): string {
  const label = tenantLabel.trim().toLowerCase();
  let parsed: URL;
  try {
    parsed = new URL(normalizePublicOrigin(origin));
  } catch {
    if (label.length >= 2) {
      return buildTenantVanityOrigin(label, {
        rootDomain: options?.rootDomain,
      });
    }
    throw new Error("resolveApplicantEmailOrigin: invalid origin");
  }

  if (isLocalDevHostname(parsed.hostname) || label.length < 2) {
    return parsed.origin;
  }

  const protocol = parsed.protocol === "http:" ? "http" : "https";
  return buildTenantVanityOrigin(label, {
    protocol,
    rootDomain: options?.rootDomain ?? getEffectiveRootDomain(),
  });
}
