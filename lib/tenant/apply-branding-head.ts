import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import {
  resolveTenantDocumentFaviconHref,
  resolveTenantDocumentTitle,
  withTenantFaviconCacheBuster,
} from "@/lib/tenant/tenant-document-metadata";

const FAVICON_REL_VALUES = ["icon", "shortcut icon", "apple-touch-icon"] as const;

function faviconType(href: string): string | undefined {
  const path = href.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

function encodeHref(href: string): string {
  if (href.startsWith("blob:") || href.startsWith("data:")) return href;
  try {
    // Encode spaces / unsafe chars in path while preserving query string.
    const url = new URL(href, "http://local.invalid");
    const encodedPath = url.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    return `${encodedPath}${url.search}${url.hash}`;
  } catch {
    return encodeURI(href);
  }
}

function isFaviconLink(node: Element): node is HTMLLinkElement {
  const rel = (node as HTMLLinkElement).rel?.toLowerCase() ?? "";
  return rel === "icon" || rel === "shortcut icon" || rel.includes("apple-touch-icon");
}

function applyFaviconAttributes(link: HTMLLinkElement, href: string) {
  link.setAttribute("href", href);
  const type = faviconType(href);
  if (type) link.type = type;
  else link.removeAttribute("type");
}

/** Update existing head links in place — never remove React/Next-managed nodes. */
function syncFaviconLinks(href: string) {
  const existing = Array.from(document.querySelectorAll("link[rel]")).filter(isFaviconLink);

  if (existing.length > 0) {
    for (const link of existing) applyFaviconAttributes(link, href);
    return;
  }

  for (const rel of FAVICON_REL_VALUES) {
    const link = document.createElement("link");
    link.rel = rel;
    applyFaviconAttributes(link, href);
    document.head.appendChild(link);
  }
}

export function resolveFaviconHref(branding: TenantBranding): string {
  return resolveTenantDocumentFaviconHref(branding);
}

export function desiredDocumentTitle(branding: TenantBranding): string {
  return resolveTenantDocumentTitle(branding);
}

export function desiredFaviconHref(branding: TenantBranding): string {
  const iconSrc = resolveFaviconHref(branding);
  return encodeHref(withTenantFaviconCacheBuster(iconSrc, branding));
}

export function applyBrandingHead(branding: TenantBranding) {
  if (typeof document === "undefined") return;

  syncFaviconLinks(desiredFaviconHref(branding));
  document.title = desiredDocumentTitle(branding);
}

/** True when the live document head already matches this branding. */
export function documentHeadMatchesBranding(branding: TenantBranding): boolean {
  if (typeof document === "undefined") return true;
  if (document.title !== desiredDocumentTitle(branding)) return false;

  const desired = desiredFaviconHref(branding);
  const links = Array.from(document.querySelectorAll("link[rel]")).filter(isFaviconLink);
  if (!links.length) return false;
  return links.every((link) => (link.getAttribute("href") ?? "") === desired);
}
