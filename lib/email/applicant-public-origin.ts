import {
  isTenantVanityHost,
  normalizePublicOrigin,
} from "@/lib/resolve-app-origin";
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

/** Keep localhost, Vercel preview/devmode, and other non-vanity app hosts as-is. */
function shouldKeepApplicantEmailAppOrigin(hostname: string, rootDomain: string): boolean {
  const host = hostname.trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase();
  if (!host) return false;
  if (isLocalDevHostname(host)) return true;
  if (host.endsWith(".vercel.app") || host.endsWith(".vercel.sh")) return true;
  if (host === root || host === `www.${root}`) return false;
  if (isTenantVanityHost(host, root)) return false;
  return true;
}

/**
 * Public origin used in applicant email links.
 * Production: `{tenant}.{ROOT_DOMAIN}`
 * Local / dev / preview deployments: keep the current app origin (`?tenant=` on paths).
 */
export function resolveApplicantEmailOrigin(
  origin: string,
  tenantLabel: string,
  options?: { rootDomain?: string }
): string {
  const label = tenantLabel.trim().toLowerCase();
  const rootDomain = options?.rootDomain ?? getEffectiveRootDomain();
  let parsed: URL;
  try {
    parsed = new URL(normalizePublicOrigin(origin));
  } catch {
    if (label.length >= 2) {
      return buildTenantVanityOrigin(label, {
        rootDomain,
      });
    }
    throw new Error("resolveApplicantEmailOrigin: invalid origin");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (label.length < 2) {
    return parsed.origin;
  }

  if (shouldKeepApplicantEmailAppOrigin(hostname, rootDomain)) {
    return parsed.origin;
  }

  const tenantVanityHost = `${label}.${rootDomain}`;
  if (hostname === tenantVanityHost) {
    return parsed.origin;
  }

  const protocol = parsed.protocol === "http:" ? "http" : "https";
  return buildTenantVanityOrigin(label, {
    protocol,
    rootDomain,
  });
}
