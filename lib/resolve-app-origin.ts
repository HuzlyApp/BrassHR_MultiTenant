import { LEGACY_EMAIL_DOMAIN } from "@/lib/email/email-domain";

type OriginRequest = Pick<Request, "headers"> & {
  nextUrl?: { origin: string }
}

/** Legacy Nexus platform host labels (not tenant vanity subdomains). */
const LEGACY_PLATFORM_HOST_LABELS = new Set(["hr", "www"]);

function currentRootDomain(): string {
  return (
    process.env.ROOT_DOMAIN?.trim().toLowerCase() ||
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() ||
    "brasshr.com"
  );
}

function isLocalDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host === "[::1]" ||
    host === "::1"
  );
}

/**
 * Rewrites legacy Nexus MedPro hostnames to Brass HR hosts.
 * Platform app (`hr.nexusmedpro.com`) → apex `brasshr.com`.
 * Tenant vanity (`test.nexusmedpro.com`) → `test.brasshr.com`.
 */
export function migrateLegacyAppOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    const legacySuffix = `.${LEGACY_EMAIL_DOMAIN}`;
    const legacyHost = LEGACY_EMAIL_DOMAIN;
    const root = currentRootDomain();

    let nextHost: string | null = null;
    if (url.hostname === legacyHost) {
      nextHost = root;
    } else if (url.hostname.endsWith(legacySuffix)) {
      const label = url.hostname.slice(0, -legacySuffix.length);
      if (!label || LEGACY_PLATFORM_HOST_LABELS.has(label.toLowerCase())) {
        nextHost = root;
      } else {
        nextHost = `${label}.${root}`;
      }
    }

    if (!nextHost) return origin;
    url.hostname = nextHost;
    return url.origin;
  } catch {
    return origin;
  }
}

function collapseMistakenPlatformSubdomain(origin: string): string {
  try {
    const url = new URL(origin);
    const root = currentRootDomain();
    if (url.hostname.toLowerCase() === `hr.${root}`) {
      url.hostname = root;
      return url.origin;
    }
    return origin;
  } catch {
    return origin;
  }
}

/**
 * Ensures a valid absolute origin for redirects and third-party callback URLs.
 * Bare `localhost:3000` or `app.example.com` become `http://…` / `https://…`.
 */
export function normalizePublicOrigin(input: string): string {
  const s = input.trim().replace(/\/$/, "")
  if (!s) throw new Error("normalizePublicOrigin: empty input")
  if (/^https?:\/\//i.test(s)) {
    return new URL(s).origin
  }
  const host = s.replace(/^\/+/, "")
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  return `${isLocal ? "http" : "https"}://${host}`
}

/**
 * Full redirect URL with required `http://` or `https://` scheme.
 */
export function normalizeRedirectUrl(url: string): string {
  const u = url.trim()
  if (!u) throw new Error("normalizeRedirectUrl: empty input")
  if (/^https?:\/\//i.test(u)) {
    return new URL(u).href
  }
  const firstSlash = u.indexOf("/")
  const hostPart = firstSlash === -1 ? u : u.slice(0, firstSlash)
  const pathPart = firstSlash === -1 ? "" : u.slice(firstSlash)
  return `${normalizePublicOrigin(hostPart)}${pathPart}`
}

/**
 * Public origin for redirects / DocuSign return URLs.
 * Prefer client-provided origin (browser), then env, then proxy headers, then Host.
 */
function finalizeResolvedOrigin(origin: string): string {
  return collapseMistakenPlatformSubdomain(migrateLegacyAppOrigin(normalizePublicOrigin(origin)))
}

/**
 * True for `{tenant}.{ROOT_DOMAIN}` (one label), e.g. jobs.brasshr.com.
 * False for apex, www, nested hosts, and non-root hosts (vercel.app, localhost).
 */
export function isTenantVanityHost(hostname: string, rootDomain?: string): boolean {
  const host = hostname.trim().toLowerCase();
  const root = (rootDomain || currentRootDomain()).trim().toLowerCase();
  if (!host || !root) return false;
  if (host === root || host === `www.${root}`) return false;
  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  return Boolean(label) && !label.includes(".");
}

/**
 * Origin for platform-level flows (owner signup, tenant-onboarding).
 * Keeps localhost / Vercel preview / dedicated app hosts.
 * Collapses tenant vanity hosts (`jobs.brasshr.com`) to the marketing apex.
 */
export function resolvePlatformAppOrigin(req: OriginRequest): string | null {
  const resolved = resolveAppOrigin(req);
  if (!resolved) return null;

  try {
    const url = new URL(resolved);
    if (isLocalDevHost(url.hostname)) return resolved;

    const root = currentRootDomain();
    const host = url.hostname.toLowerCase();
    if (host === root || host === `www.${root}`) return url.origin;

    // Owner setup emails must not open on a tenant vanity host.
    if (isTenantVanityHost(host, root)) {
      return `https://${root}`;
    }

    // Preview / staging app hosts (e.g. brasshr-devmode.vercel.app) stay as-is.
    return url.origin;
  } catch {
    return resolved;
  }
}

export function resolveAppOrigin(req: OriginRequest, clientOrigin?: string | null): string | null {
  const fromClient = clientOrigin?.trim().replace(/\/$/, "")
  if (fromClient) {
    try {
      return finalizeResolvedOrigin(fromClient)
    } catch {
      /* ignore */
    }
  }

  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (env) {
    try {
      return finalizeResolvedOrigin(new URL(env).origin)
    } catch {
      try {
        return finalizeResolvedOrigin(env)
      } catch {
        /* ignore */
      }
    }
  }

  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  if (forwardedProto && forwardedHost) {
    const proto = /^https?$/i.test(forwardedProto) ? forwardedProto.toLowerCase() : "https"
    try {
      return finalizeResolvedOrigin(`${proto}://${forwardedHost}`)
    } catch {
      /* ignore */
    }
  }

  const host = req.headers.get("host")?.trim()
  if (host) {
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]")
    const proto = isLocal ? "http" : "https"
    try {
      return finalizeResolvedOrigin(`${proto}://${host}`)
    } catch {
      /* ignore */
    }
  }

  try {
    const o = req.nextUrl?.origin
    if (o && o !== "null" && !o.includes("0.0.0.0")) return finalizeResolvedOrigin(o)
  } catch {
    /* ignore */
  }

  return null
}
