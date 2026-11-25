import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";
import { normalizeEinInput } from "@/lib/tenant/business-info-validation";

const optionalText = (max: number) => z.string().trim().max(max).optional();

const input = z.object({
  legalName: optionalText(200),
  tradeName: optionalText(200),
  address: optionalText(500),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  country: optionalText(100),
  ein: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{2}-?\d{7}$/.test(value), "Enter a valid EIN (XX-XXXXXXX).")
    .optional(),
  companySize: optionalText(50),
  industry: optionalText(100),
  industries: z.array(z.string().trim().min(1).max(100)).max(40).optional(),
});

/** Launch Pad collects optional details without requiring the full Settings form. */
export async function PATCH(req: Request) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!auth.godAdmin && auth.role !== "admin") {
    return NextResponse.json({ error: "Tenant admin access is required." }, { status: 403 });
  }
  const sb = createServiceRoleClient();
  if (!sb) return NextResponse.json({ error: "Server not configured." }, { status: 503 });
  const tenantId = await resolveEffectiveAdminTenantId(sb, auth);
  if (!tenantId) return NextResponse.json({ error: "No organization selected." }, { status: 403 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid organization details." },
      { status: 400 }
    );
  }
  const {
    legalName,
    tradeName,
    address,
    city,
    state,
    postalCode,
    country,
    ein,
    companySize,
    industry,
    industries,
  } = parsed.data;
  const primaryIndustry =
    industry?.trim() ||
    (industries && industries.length > 0 ? industries[0] : undefined);
  const { data, error } = await sb
    .from("tenants")
    .update({
      ...(legalName !== undefined ? { legal_name: legalName || null } : {}),
      ...(tradeName !== undefined ? { name: tradeName || null } : {}),
      ...(address !== undefined ? { address_line_1: address || null } : {}),
      ...(city !== undefined ? { city: city || null } : {}),
      ...(state !== undefined ? { state: state || null } : {}),
      ...(postalCode !== undefined ? { postal_code: postalCode || null } : {}),
      ...(country !== undefined ? { country: country || null } : {}),
      ...(ein !== undefined ? { ein: normalizeEinInput(ein) || null } : {}),
      ...(companySize !== undefined ? { company_size: companySize || null } : {}),
      ...(primaryIndustry !== undefined ? { industry: primaryIndustry || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Could not save organization details." }, { status: 500 });
  }

  if (industries !== undefined || primaryIndustry !== undefined) {
    try {
      const { syncTenantIndustryFromLabels } = await import("@/lib/ai-catalog/sync-tenant-industry");
      await syncTenantIndustryFromLabels(sb, {
        tenantId,
        primaryLabel: primaryIndustry ?? null,
        additionalLabels: industries ?? (primaryIndustry ? [primaryIndustry] : []),
      });
    } catch (bindError) {
      const message =
        bindError instanceof Error ? bindError.message : "Could not save industries.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  await invalidateTenantBrandingCache(tenantId);
  return NextResponse.json({ ok: true });
}
