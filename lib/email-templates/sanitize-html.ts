const FORBIDDEN_TAG_RE = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|link|meta|base|style)\b[^>]*>/gi;
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_RE = /\b(href|src|xlink:href)\s*=\s*("|')\s*javascript:/gi;

export function sanitizeEmailHtml(html: string): string {
  let out = html.replace(FORBIDDEN_TAG_RE, "");
  out = out.replace(EVENT_HANDLER_RE, "");
  out = out.replace(JAVASCRIPT_URL_RE, "");
  return out.trim();
}

export function assertSafeEmailHtml(html: string): void {
  const probe = html.toLowerCase();
  if (probe.includes("<script") || probe.includes("javascript:")) {
    throw new Error("Unsafe HTML content detected");
  }
}
