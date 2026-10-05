import { NextResponse } from "next/server";
import { closeExpiredPublishedJobsAllTenants } from "@/lib/jobs/service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization")?.trim() ?? "";
  return header === `Bearer ${secret}`;
}

/** Hourly replacement for closing expired jobs inside GET /api/admin/jobs. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const closed = await closeExpiredPublishedJobsAllTenants(supabase);
    return NextResponse.json({ ok: true, closed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to close expired jobs";
    console.error("[cron] close-expired-jobs", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
