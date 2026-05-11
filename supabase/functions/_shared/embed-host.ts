/** Zoho Sign embedtoken `host` — must be HTTPS; match `lib/zoho-sign-embed-host.ts`. */

export function normalizeZohoEmbedHostCandidate(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return "";
  }

  const hn = url.hostname.toLowerCase();
  if (hn === "localhost" || hn === "127.0.0.1") return "";

  if (url.protocol === "http:") {
    return `https://${url.host}`;
  }

  if (url.protocol !== "https:") return "";

  return url.origin;
}
