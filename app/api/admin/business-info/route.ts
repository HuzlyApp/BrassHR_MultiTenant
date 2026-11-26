import { NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveBusinessInfoValidationContext } from "@/lib/tenant/resolve-business-info-context";
import {
  firstBusinessInfoError,
  isBusinessInfoValid,
  normalizeBusinessInfoBody,
  validateBusinessInfoForm,
} from "@/lib/tenant/business-info-validation";

/**
 * Updates tenant business information with server-side validation.
 */
export async function PATCH(req: Request) {
  const auth = await requireStaffApiSession(req);
  if (auth instanceof NextResponse) return auth;

  const svc = createServiceRoleClient();
  if (!svc) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId = await resolveEffectiveAdminTenantId(svc, auth);
  if (!tenantId) return NextResponse.json({ error: "Organization unavailable" }, { status: 403 });
  const additional: Record<string, string | null> = {};
  if ("legalName" in body) additional.legal_name = String(body.legalName ?? "").trim().slice(0, 200) || null;
  if ("subdomain" in body) {
    const value = String(body.subdomain ?? "").trim().toLowerCase();
    if (value && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
    additional.subdomain = value || null;
  }
  if ("website" in body) {
    const value = String(body.website ?? "").trim();
    if (value) {
      try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
      catch { return NextResponse.json({ error: "Invalid website URL" }, { status: 400 }); }
    }
    additional.website = value || null;
  }

  const input = normalizeBusinessInfoBody(body);
  const context = await resolveBusinessInfoValidationContext(svc, input.state);
  const errors = validateBusinessInfoForm(input, context);

  if (!isBusinessInfoValid(input, context)) {
    return NextResponse.json(
      {
        error: firstBusinessInfoError(errors) ?? "Please correct the highlighted fields.",
        errors,
      },
      { status: 400 }
    );
  }

  const { error: updateErr } = await svc
    .from("tenants")
    .update({
      ...additional,
      name: input.companyName,
      industry: input.industry,
      company_size: input.companySize,
      city: input.city,
      state: input.state,
      address_line_1: input.address,
      phone: input.phone,
      email: input.email,
      postal_code: input.zipCode,
      ein: input.ein || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  try {
    const additionalKeys = Array.isArray(body.industryKeys)
      ? body.industryKeys.map((value) => String(value))
      : [];
    const { syncTenantIndustryFromLabels } = await import("@/lib/ai-catalog/sync-tenant-industry");
    await syncTenantIndustryFromLabels(svc, {
      tenantId,
      primaryLabel: input.industry,
      additionalKeys,
    });
  } catch (bindError) {
    const message = bindError instanceof Error ? bindError.message : "Could not save hire-for industries.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
