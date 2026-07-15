import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ORGANIZATION_LOGOS_BUCKET } from "@/lib/supabase-storage-buckets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return "png";
  }
}

/** Upload tenant favicon during onboarding (service role; tenantId in form). */
export async function POST(req: NextRequest) {
  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tenantId = String(formData.get("tenantId") ?? "").trim();

    if (!file || !tenantId) {
      return NextResponse.json({ error: "Missing file or tenantId" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Favicon must be 2MB or smaller." }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    const extFromName = file.name.split(".").pop()?.toLowerCase();
    const allowedByExt = extFromName === "ico" || extFromName === "png" || extFromName === "jpg" || extFromName === "jpeg" || extFromName === "webp" || extFromName === "svg";
    if (!ALLOWED.has(mime) && !allowedByExt) {
      return NextResponse.json({ error: "Use PNG, JPG, WEBP, SVG, or ICO." }, { status: 400 });
    }

    const ext = ALLOWED.has(mime) ? extForMime(mime) : (extFromName === "jpeg" ? "jpg" : extFromName || "png");
    const objectPath = `${tenantId}/favicon-logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await svc.storage.from(ORGANIZATION_LOGOS_BUCKET).upload(objectPath, buffer, {
      contentType: mime || `image/${ext}`,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const url = getSupabaseUrl();
    const publicUrl = url
      ? `${url}/storage/v1/object/public/${ORGANIZATION_LOGOS_BUCKET}/${objectPath}`
      : objectPath;

    const { error: upErr } = await svc
      .from("tenants")
      .update({ favicon_url: publicUrl })
      .eq("id", tenantId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await invalidateTenantBrandingCache(tenantId);

    return NextResponse.json({ ok: true, faviconUrl: publicUrl });
  } catch (err: unknown) {
    console.error("[tenants/favicon]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
