/**
 * Client-side: extract tenant DNS label from `{label}.{ROOT_DOMAIN}` (e.g. subdomaintest.brasshr.com).
 */
export function getClientTenantHostLabel(): string | null {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname.trim().toLowerCase();
  const root =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() || "brasshr.com";

  if (!host || host === "localhost" || host.startsWith("127.0.0.1")) return null;
  if (host === root || host === `www.${root}`) return null;

  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  if (!label || label.includes(".")) return null;
  return label;
}
