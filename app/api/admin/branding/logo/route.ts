import { NextRequest, NextResponse } from "next/server";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { ORGANIZATION_LOGOS_BUCKET } from "@/lib/supabase-storage-buckets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

type LogoField = "logo" | "login" | "signup" | "favicon";

const LOGO_COLUMN: Record<LogoField, "logo_url" | "login_logo_url" | "signup_logo_url" | "favicon_url"> = {
  logo: "logo_url",
  login: "login_logo_url",
  signup: "signup_logo_url",
  favicon: "favicon_url",
};

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

function parseLogoField(value: FormDataEntryValue | null): LogoField {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "login" || raw === "signup" || raw === "favicon") return raw;
  return "logo";
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
    const field = parseLogoField(formData.get("field"));
    const column = LOGO_COLUMN[field];

    if (!file) {
      return NextResponse.json({ error: "Choose a logo file first." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be 2MB or smaller." }, { status: 400 });
    }

    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Use PNG, JPG, WEBP, or SVG." }, { status: 400 });
    }

    const ext = extForMime(mime);
    const objectPath = `${tenantId}/${field}-logo.${ext}`;
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

    const { error: upErr } = await svc.from("tenants").update({ [column]: publicUrl }).eq("id", tenantId);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    await invalidateTenantBrandingCache(tenantId);

    return NextResponse.json({
      ok: true,
      logoUrl: publicUrl,
      field,
      tenantId,
    });
  } catch (err: unknown) {
    console.error("[admin/branding/logo]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
