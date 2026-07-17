import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ORGANIZATION_LOGOS_BUCKET } from "@/lib/supabase-storage-buckets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
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

/** Upload auth background during tenant onboarding (service role; tenantId in form). */
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
      return NextResponse.json({ error: "Background image must be 3MB or smaller." }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    const extFromName = file.name.split(".").pop()?.toLowerCase();
    const allowedByExt =
      extFromName === "png" ||
      extFromName === "jpg" ||
      extFromName === "jpeg" ||
      extFromName === "webp";
    if (!ALLOWED.has(mime) && !allowedByExt) {
      return NextResponse.json({ error: "Use PNG, JPG, or WEBP." }, { status: 400 });
    }

    const ext = ALLOWED.has(mime)
      ? extForMime(mime)
      : extFromName === "jpeg"
        ? "jpg"
        : extFromName || "jpg";
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
    const publicUrl = url
      ? `${url}/storage/v1/object/public/${ORGANIZATION_LOGOS_BUCKET}/${objectPath}`
      : objectPath;

    const { error: upErr } = await svc
      .from("tenants")
      .update({ auth_background_image_url: publicUrl })
      .eq("id", tenantId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await invalidateTenantBrandingCache(tenantId);

    return NextResponse.json({ ok: true, backgroundImageUrl: publicUrl });
  } catch (err: unknown) {
    console.error("[tenants/background]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
