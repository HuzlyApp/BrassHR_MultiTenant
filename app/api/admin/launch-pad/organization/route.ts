import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { invalidateTenantBrandingCache } from "@/lib/tenant/invalidate-tenant-branding-cache";
import { normalizeEinInput } from "@/lib/tenant/business-info-validation";

const input = z.object({
  address: z.string().trim().max(500).optional(),
  ein: z.string().trim().refine((value) => !value || /^\d{2}-?\d{7}$/.test(value), "Enter a valid EIN (XX-XXXXXXX).").optional(),
  companySize: z.string().trim().max(50).optional(),
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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid organization details." }, { status: 400 });
  const { address, ein, companySize } = parsed.data;
  const { data, error } = await sb.from("tenants").update({
    ...(address !== undefined ? { address_line_1: address || null } : {}),
    ...(ein !== undefined ? { ein: normalizeEinInput(ein) || null } : {}),
    ...(companySize !== undefined ? { company_size: companySize || null } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", tenantId).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Could not save organization details." }, { status: 500 });
  await invalidateTenantBrandingCache(tenantId);
  return NextResponse.json({ ok: true });
}
