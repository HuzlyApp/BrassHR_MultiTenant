import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { insertServiceAreaWaitlist } from "@/lib/service-area/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  const source = body.source === "signup" ? "signup" : "apply";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  let tenantId: string | null = null;
  let jobId: string | null = null;
  const tenantSlug = String(body.tenantSlug ?? "").trim().toLowerCase();
  const jobToken = String(body.jobToken ?? "").trim();
  if (tenantSlug) {
    const tenant = await resolvePublicTenant(supabase, tenantSlug);
    tenantId = tenant?.id ?? null;
    if (tenant && jobToken) {
      const { data: job } = await supabase
        .from("job_requisitions")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("public_job_token", jobToken)
        .maybeSingle();
      jobId = job?.id ? String(job.id) : null;
    }
  }

  await insertServiceAreaWaitlist(supabase, {
    email,
    city: String(body.city ?? "").trim() || null,
    state: String(body.state ?? "").trim() || null,
    source,
    tenantId,
    jobId,
  });

  return NextResponse.json({ ok: true });
}
