import { NextRequest, NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  MATCH_ANALYSIS_ERROR,
  MatchAnalysisGenerationError,
  runMatchAnalysisBulk,
} from "@/lib/jobs/match-analysis";
import { resolveStaffTenantId } from "@/lib/jobs/tenant";
import { enforceMatchAnalysisRateLimits } from "@/lib/jobs/match-analysis/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BULK = 25;

const bodySchema = z.object({
  jobApplicationIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
  analysisMode: z.enum(["analyze", "deep"]).optional(),
});

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

  const limited = await enforceMatchAnalysisRateLimits(req, tenantId, auth.userId);
  if (limited) return limited;

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Provide 1–${MAX_BULK} jobApplicationIds`,
        code: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const analysisMode = parsed.data.analysisMode === "deep" ? "deep" : "analyze";

  const { data: owned, error: ownedError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", parsed.data.jobApplicationIds);

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }

  const ownedIds = new Set((owned ?? []).map((row) => row.id as string));
  const missing = parsed.data.jobApplicationIds.filter((id) => !ownedIds.has(id));
  if (missing.length) {
    return NextResponse.json(
      { error: "One or more applications were not found for this tenant", missing },
      { status: 404 }
    );
  }

  try {
    const results = await runMatchAnalysisBulk({
      supabase,
      tenantId,
      jobApplicationIds: parsed.data.jobApplicationIds,
      analyzedByUserId: auth.devBypass ? null : auth.userId,
      analysisMode,
    });

    void writeActivityLog({
      actorUserId: auth.userId,
      action: "job_application.match_analyzed_bulk",
      entityType: "job_application",
      tenantId,
      request: req,
      metadata: {
        count: results.length,
        analysisMode,
        analyzed: results.filter((r) => "status" in r.result && r.result.status === "ANALYZED")
          .length,
        failed: results.filter((r) => "status" in r.result && r.result.status === "FAILED")
          .length,
      },
    });

    return NextResponse.json({ results });
  } catch (error) {
    const code =
      error instanceof MatchAnalysisGenerationError ? error.code : "UNKNOWN";
    console.error("[job-applications/match-analysis/bulk]", {
      code,
      tenantId,
      userId: auth.userId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: MATCH_ANALYSIS_ERROR, code }, { status: 502 });
  }
}
