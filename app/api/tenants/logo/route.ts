import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ORGANIZATION_LOGOS_BUCKET } from "@/lib/supabase-storage-buckets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

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
    default:
      return "png";
  }
}

/** Upload tenant logo during onboarding (service role; tenantId in form). */
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
      return NextResponse.json({ error: "Logo must be 2MB or smaller" }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const ext = extForMime(mime);
    const objectPath = `${tenantId}/logo.${ext}`;
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

    const { error: upErr } = await svc.from("tenants").update({ logo_url: publicUrl }).eq("id", tenantId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logoUrl: publicUrl });
  } catch (err: unknown) {
    console.error("[tenants/logo]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
