import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { evaluateServiceAreaWithDb } from "@/lib/service-area/db";
import { ACCOUNT_ACCESS_ACTIVE, ACCOUNT_ACCESS_WAITLIST } from "@/lib/service-area/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    tenantId?: string;
    reason?: string;
  };
  const tenantId = String(body.tenantId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!tenantId || !reason) {
    return NextResponse.json({ error: "tenantId and reason are required" }, { status: 400 });
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, primary_city, primary_state, primary_postal_code, city, state, postal_code, account_access")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const decision = await evaluateServiceAreaWithDb(supabase, {
    tenantId,
    action: "activate_tenant",
    location: {
      country: "US",
      city: String(tenant.primary_city ?? tenant.city ?? ""),
      state: String(tenant.primary_state ?? tenant.state ?? ""),
      postalCode: String(tenant.primary_postal_code ?? tenant.postal_code ?? ""),
      locationType: "onsite",
    },
  });

  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: {
          code: decision.reasonCode,
          messageKey: decision.messageKey,
          field: "primary_state",
        },
      },
      { status: 422 }
    );
  }

  const { error: overrideError } = await supabase.from("service_area_overrides").insert({
    tenant_id: tenantId,
    reason,
    created_by: auth.userId,
  });
  if (overrideError) return NextResponse.json({ error: overrideError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("tenants")
    .update({ account_access: ACCOUNT_ACCESS_ACTIVE })
    .eq("id", tenantId)
    .eq("account_access", ACCOUNT_ACCESS_WAITLIST);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, accountAccess: ACCOUNT_ACCESS_ACTIVE });
}
