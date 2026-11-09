import { NextRequest, NextResponse } from "next/server";
import { auditInboundApiCall, requireInboundApiAuth } from "@/lib/integrations/auth";
import { integrationError } from "@/lib/integrations/http";
import { searchInboundJob } from "@/lib/integrations/jobs";
import { JobValidationError } from "@/lib/jobs/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireInboundApiAuth(req, { kind: "search" });
  if (auth instanceof NextResponse) return auth;

  try {
    const job = await searchInboundJob(
      auth.supabase,
      auth.tenantId,
      req.nextUrl.searchParams
    );
    if (!job) {
      auditInboundApiCall({
        req,
        auth,
        action: "inbound_api.jobs.search",
        entityType: "job_requisition",
        outcome: "success",
        metadata: { found: false },
      });
      return NextResponse.json({ found: false }, { status: 404 });
    }

    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.jobs.search",
      entityType: "job_requisition",
      entityId: job.id,
      outcome: "success",
      metadata: { found: true },
    });
    return NextResponse.json({
      found: true,
      id: job.id,
      external_req_id: job.external_req_id,
      title: job.title,
      status: job.status,
      created_at: job.created_at,
    });
  } catch (error) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.jobs.search",
      entityType: "job_requisition",
      outcome: "failure",
      metadata: {
        message: error instanceof Error ? error.message : "unknown",
      },
    });
    if (error instanceof JobValidationError) {
      return integrationError(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[api/v1/jobs/search]", error);
    return integrationError(500, "INTERNAL", "Failed to search jobs");
  }
}
