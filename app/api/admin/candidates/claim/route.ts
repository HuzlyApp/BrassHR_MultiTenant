import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { bulkClaimWorkers } from "@/lib/candidates/bulk-claim";
import { BULK_CLAIM_MAX_IDS, normalizeUuidList } from "@/lib/candidates/claim";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const tenantId = await resolveStaffTenantId(supabase, auth).catch(() => null);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  if (auth.devBypass) {
    return NextResponse.json(
      { error: "Claim requires an authenticated staff session (dev bypass cannot claim)." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    candidateIds?: unknown;
    ids?: unknown;
    operationId?: unknown;
  } | null;

  const candidateIds = normalizeUuidList(body?.candidateIds ?? body?.ids);
  if (candidateIds.length === 0) {
    return NextResponse.json(
      {
        error: `Provide 1–${BULK_CLAIM_MAX_IDS} candidateIds (stable worker UUIDs).`,
      },
      { status: 400 }
    );
  }

  const operationId =
    typeof body?.operationId === "string" && body.operationId.trim()
      ? body.operationId.trim().slice(0, 120)
      : randomUUID();

  const result = await bulkClaimWorkers({
    supabase,
    tenantId,
    recruiterUserId: auth.userId,
    actorUserId: auth.userId,
    candidateIds,
    operationId,
    request: req,
  });

  const status =
    result.claimed.length > 0
      ? 200
      : result.failed.length === candidateIds.length
        ? 500
        : 200;

  return NextResponse.json(result, { status });
}
