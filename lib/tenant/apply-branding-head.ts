import {
  brandingFallbackForSlug,
  isTenantApplicantPortalSlug,
  normalizeBrandingImageSrc,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

const DEFAULT_FAVICON = "/icons/braas-HR/BrassHR-logo.svg";

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
  const slug = branding.slug?.trim().toLowerCase() ?? "";

  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const isRecruiterAuthEntry =
      path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/login" ||
      path.startsWith("/login/") ||
      path === "/signin" ||
      path.startsWith("/signin/");
    if (isRecruiterAuthEntry) {
      const fallback = brandingFallbackForSlug(branding.slug).logoUrl || DEFAULT_FAVICON;
      return normalizeBrandingImageSrc(branding.faviconUrl || branding.logoUrl, fallback, {
        allowBlob: true,
      });
    }
  }

  if (isTenantApplicantPortalSlug(slug)) {
    return `/api/tenant-favicon?slug=${encodeURIComponent(slug)}`;
  }

  if (slug === PLATFORM_DEFAULT_TENANT_SLUG) {
    return `/api/tenant-favicon?slug=${encodeURIComponent(PLATFORM_DEFAULT_TENANT_SLUG)}`;
  }

  const fallback = brandingFallbackForSlug(branding.slug).logoUrl || DEFAULT_FAVICON;
  return normalizeBrandingImageSrc(branding.faviconUrl || branding.logoUrl, fallback, {
    allowBlob: true,
  });
}

export function applyBrandingHead(branding: TenantBranding) {
  if (typeof document === "undefined") return;

  const iconSrc = resolveFaviconHref(branding);
  const cacheBust = `${iconSrc}${iconSrc.includes("?") ? "&" : "?"}v=${encodeURIComponent(branding.slug ?? "default")}`;

  syncFaviconLinks(cacheBust);

  const company = branding.companyName?.trim();
  if (company) document.title = company;
}
