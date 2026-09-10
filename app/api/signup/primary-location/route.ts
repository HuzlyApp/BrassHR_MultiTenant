import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { evaluateSignupPrimaryLocation } from "@/lib/service-area/signup";
import { ACCOUNT_ACCESS_ACTIVE, ACCOUNT_ACCESS_WAITLIST } from "@/lib/service-area/types";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Server not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { city?: string; state?: string; postalCode?: string };
  const city = String(body.city ?? "").trim();
  const state = String(body.state ?? "").trim();
  if (!city || !state) {
    return NextResponse.json({ error: "City and state are required." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, hq_state, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const result = await evaluateSignupPrimaryLocation(supabase, {
    city,
    state,
    postalCode: body.postalCode ?? null,
    hqState: profile?.hq_state ?? null,
    email: profile?.email ?? user.email ?? null,
  });

  const waitlisted = result.accountAccess === ACCOUNT_ACCESS_WAITLIST;
  await supabase
    .from("users")
    .update({
      primary_city: city,
      primary_state: state,
      primary_postal_code: body.postalCode ?? null,
      signup_waitlist_pending: waitlisted,
    })
    .eq("id", user.id);

  if (profile?.tenant_id) {
    await supabase
      .from("tenants")
      .update({
        primary_city: city,
        primary_state: state,
        primary_postal_code: body.postalCode ?? null,
        account_access: waitlisted ? ACCOUNT_ACCESS_WAITLIST : ACCOUNT_ACCESS_ACTIVE,
      })
      .eq("id", profile.tenant_id);
  }

  return NextResponse.json({
    allowed: !waitlisted,
    hqInHold: result.hqInHold,
  });
}
