import { NextRequest, NextResponse } from "next/server";
import { auditInboundApiCall, requireInboundApiAuth } from "@/lib/integrations/auth";
import { integrationError } from "@/lib/integrations/http";
import { createInboundJob } from "@/lib/integrations/jobs";
import { JobValidationError } from "@/lib/jobs/types";

export const runtime = "nodejs";

function mapJobError(error: unknown): NextResponse {
  if (error instanceof JobValidationError) {
    const details = Object.entries(error.fieldErrors ?? {}).map(([field, message]) => ({
      field,
      message: String(message),
    }));
    return integrationError(400, "VALIDATION_ERROR", error.message, details);
  }
  console.error("[api/v1/jobs POST]", error);
  return integrationError(
    500,
    "INTERNAL",
    "Failed to create job"
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireInboundApiAuth(req, { kind: "write" });
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.jobs.create",
      entityType: "job_requisition",
      outcome: "failure",
      metadata: { reason: "invalid_json" },
    });
    return integrationError(400, "VALIDATION_ERROR", "Request body must be JSON");
  }

  try {
    const result = await createInboundJob(auth.supabase, {
      tenantId: auth.tenantId,
      actorUserId: auth.createdByUserId,
      body,
    });
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.jobs.create",
      entityType: "job_requisition",
      entityId: result.id,
      outcome: "success",
      metadata: {
        created: result.created,
        external_req_id: result.external_req_id,
      },
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.jobs.create",
      entityType: "job_requisition",
      outcome: "failure",
      metadata: {
        message: error instanceof Error ? error.message : "unknown",
      },
    });
    return mapJobError(error);
  }
}

export async function GET() {
  return integrationError(
    400,
    "VALIDATION_ERROR",
    "Listing jobs is not supported. Use GET /api/v1/jobs/search with exactly one identifier."
  );
}
