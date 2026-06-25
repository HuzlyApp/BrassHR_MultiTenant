import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { data: profile, error: profileErr } = await svc
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const tenantId = profile?.tenant_id ? String(profile.tenant_id) : "";
  if (!tenantId) {
    return NextResponse.json({ error: "No organization is linked to your account." }, { status: 400 });
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

  return NextResponse.json({ ok: true });
}
