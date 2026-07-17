import { NextRequest, NextResponse } from "next/server";
import { getPublishedJobByToken } from "@/lib/jobs/service";
import { resolvePublicTenant } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Jobs are temporarily unavailable" }, { status: 503 });

  try {
    const tenant = await resolvePublicTenant(supabase, req.nextUrl.searchParams.get("tenant"));
    if (!tenant) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    const { token } = await context.params;
    const job = await getPublishedJobByToken(supabase, tenant.id, token);
    if (!job) return NextResponse.json({ error: "Job not found or unavailable" }, { status: 404 });
    return NextResponse.json({ job, tenant });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 500 }
    );
  }
}
