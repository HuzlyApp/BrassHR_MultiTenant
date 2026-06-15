import { readFile } from "fs/promises";
import path from "path";
import { createClient as createSb } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import {
  brandingFallbackForSlug,
  brandingFromTenantRow,
  normalizeBrandingImageSrc,
  PLATFORM_DEFAULT_TENANT_SLUG,
} from "@/lib/tenant/tenant-branding";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

export const runtime = "nodejs";

const TENANT_BRANDING_SELECT =
  "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url";

const DEFAULT_FAVICON = "/icons/braas-HR/BrassHR-logo.svg";

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

function contentTypeFromPath(iconPath: string): string {
  const lower = iconPath.split("?")[0]?.toLowerCase() ?? "";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return "application/octet-stream";
}

async function readPublicAsset(iconSrc: string): Promise<Buffer | null> {
  if (!iconSrc.startsWith("/") || iconSrc.startsWith("//")) return null;
  const relative = iconSrc.split("?")[0]?.split("#")[0] ?? "";
  if (!relative) return null;

  try {
    const filePath = path.join(process.cwd(), "public", relative.replace(/^\//, ""));
    return await readFile(filePath);
  } catch {
    return null;
  }
}

async function fetchRemoteAsset(url: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim();
    return {
      body: await res.arrayBuffer(),
      contentType: contentType || contentTypeFromPath(url),
    };
  } catch {
    return null;
  }
}

async function resolveIconResponse(
  iconSrc: string,
  requestUrl: string
): Promise<{ body: Buffer | ArrayBuffer; contentType: string } | null> {
  if (iconSrc.startsWith("http://") || iconSrc.startsWith("https://")) {
    return fetchRemoteAsset(iconSrc);
  }

  const local = await readPublicAsset(iconSrc);
  if (local) {
    return { body: local, contentType: contentTypeFromPath(iconSrc) };
  }

  const absolute = new URL(iconSrc, requestUrl).toString();
  return fetchRemoteAsset(absolute);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug")?.trim().toLowerCase();
  const subdomainParam = searchParams.get("subdomain")?.trim().toLowerCase();
  const resolvedSlug = slugParam || subdomainParam || PLATFORM_DEFAULT_TENANT_SLUG;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  let branding = brandingFallbackForSlug(resolvedSlug);

  if (url && key) {
    const supabase = createSb(url, key);
    let row: TenantBrandingRow | null = null;

    if (subdomainParam && !slugParam) {
      const { data: bySub } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("subdomain", subdomainParam)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      row = bySub ?? null;
      if (!row) {
        const { data: bySlug } = await supabase
          .from("tenants")
          .select(TENANT_BRANDING_SELECT)
          .eq("slug", subdomainParam)
          .eq("is_active", true)
          .maybeSingle<TenantBrandingRow>();
        row = bySlug ?? null;
      }
    } else {
      const { data } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("slug", resolvedSlug)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      row = data ?? null;
    }

    branding = brandingFromTenantRow(row, resolvedSlug);
  }

  const fallback = brandingFallbackForSlug(branding.slug).logoUrl || DEFAULT_FAVICON;
  const iconSrc = normalizeBrandingImageSrc(branding.logoUrl, fallback, { allowBlob: true });

  const resolved =
    (await resolveIconResponse(iconSrc, req.url)) ??
    (iconSrc !== fallback ? await resolveIconResponse(fallback, req.url) : null) ??
    (await resolveIconResponse(DEFAULT_FAVICON, req.url));

  if (!resolved) {
    return NextResponse.json({ error: "Favicon not found" }, { status: 404 });
  }

  const body =
    resolved.body instanceof Buffer
      ? new Uint8Array(resolved.body)
      : new Uint8Array(resolved.body)

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": resolved.contentType,
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
