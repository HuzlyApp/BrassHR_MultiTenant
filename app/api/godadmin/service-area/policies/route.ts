import { NextRequest, NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("service_area_policies")
    .select(
      "id, source, tenant_id, code, label, match_type, states, cities, effect, is_active, message_key, updated_at"
    )
    .eq("source", "platform")
    .order("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { policyId?: string; deactivate?: boolean };
  const policyId = String(body.policyId ?? "").trim();
  if (!policyId) return NextResponse.json({ error: "policyId is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("service_area_policies")
    .update({ is_active: body.deactivate === false })
    .eq("id", policyId)
    .eq("source", "platform")
    .select("id, code, is_active")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  return NextResponse.json({ policy: data });
}
