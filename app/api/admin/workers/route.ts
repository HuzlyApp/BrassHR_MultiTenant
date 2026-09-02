import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { parseBulkDeleteIds } from "@/lib/jobs/service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { bulkDeleteWorkers } from "@/lib/workers/bulk-delete-workers";

export const runtime = "nodejs";

function formatApiError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [record.message, record.details, record.hint]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  return fallback;
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;
  const supabase = createServiceRoleClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const tenantId = await resolveStaffTenantId(supabase, auth);
    if (!tenantId) return NextResponse.json({ error: "No tenant selected" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = parseBulkDeleteIds(body?.ids);
    if (!ids.length) {
      return NextResponse.json({ error: "At least one candidate id is required" }, { status: 400 });
    }

    const { deletedIds } = await bulkDeleteWorkers(supabase, tenantId, ids);
    if (!deletedIds.length) {
      return NextResponse.json({ error: "No candidates were deleted" }, { status: 404 });
    }

    return NextResponse.json({ deletedIds, count: deletedIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Failed to delete candidates") },
      { status: 500 }
    );
  }
}
