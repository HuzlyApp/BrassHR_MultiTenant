import { NextResponse } from "next/server";
import { requireGodAdminApiSession } from "@/lib/auth/require-god-admin-api";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { backfillFirmaWorkspacesForAllTenants } from "@/lib/firma/backfill-tenant-workspaces";

export const runtime = "nodejs";

/** God Admin: idempotent Firma workspace backfill for every tenant, including Braas HR. */
export async function POST() {
  const auth = await requireGodAdminApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const result = await backfillFirmaWorkspacesForAllTenants(supabase);
    const failed = result.results.filter((row) => row.status === "failed");
    return NextResponse.json({
      ok: failed.length === 0,
      platformTenantId: result.platformTenantId,
      platformCreated: result.platformCreated,
      tenants: result.results,
      failedCount: failed.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Firma workspace backfill failed";
    console.error("[firma-provision] backfill failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
