import type { NextRequest } from "next/server"

/**
 * Ensures a valid absolute origin for redirects and third-party APIs (e.g. Zoho `redirect_pages`).
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
 * Full redirect URL with required `http://` or `https://` scheme (Zoho rejects scheme-less URLs).
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
export function resolveAppOrigin(req: NextRequest, clientOrigin?: string | null): string | null {
  const fromClient = clientOrigin?.trim().replace(/\/$/, "")
  if (fromClient) {
    try {
      return normalizePublicOrigin(fromClient)
    } catch {
      /* ignore */
    }
  }

  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "")
  if (env) {
    try {
      return normalizePublicOrigin(new URL(env).origin)
    } catch {
      try {
        return normalizePublicOrigin(env)
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
      return normalizePublicOrigin(`${proto}://${forwardedHost}`)
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
      return normalizePublicOrigin(`${proto}://${host}`)
    } catch {
      /* ignore */
    }
  }

  try {
    const o = req.nextUrl?.origin
    if (o && o !== "null" && !o.includes("0.0.0.0")) return normalizePublicOrigin(o)
  } catch {
    /* ignore */
  }

  return null
}
