import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ORGANIZATION_LOGOS_BUCKET } from "@/lib/supabase-storage-buckets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(svc, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });

  if (!tenantId) {
    return NextResponse.json({ error: "No organization selected. Switch tenant and try again." }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Choose a background image first." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Background image must be 3MB or smaller." }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Use PNG, JPG, or WEBP." }, { status: 400 });
    }

    const ext = extForMime(mime);
    const objectPath = `${tenantId}/auth-bg.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await svc.storage.from(ORGANIZATION_LOGOS_BUCKET).upload(objectPath, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const url = getSupabaseUrl();
    // Version param busts browser/CDN caches since the object path is fixed per tenant.
    const publicUrl = url
      ? `${url}/storage/v1/object/public/${ORGANIZATION_LOGOS_BUCKET}/${objectPath}?v=${Date.now()}`
      : objectPath;

    const { error: upErr } = await svc
      .from("tenants")
      .update({ auth_background_image_url: publicUrl })
      .eq("id", tenantId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await invalidateTenantBrandingCache(tenantId);

    return NextResponse.json({ ok: true, backgroundImageUrl: publicUrl, tenantId });
  } catch (err: unknown) {
    console.error("[admin/branding/background]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
