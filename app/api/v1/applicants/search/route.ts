import { NextRequest, NextResponse } from "next/server";
import { auditInboundApiCall, requireInboundApiAuth } from "@/lib/integrations/auth";
import { searchInboundApplicant } from "@/lib/integrations/applicants";
import { integrationError } from "@/lib/integrations/http";
import { JobValidationError } from "@/lib/jobs/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireInboundApiAuth(req, { kind: "search" });
  if (auth instanceof NextResponse) return auth;

  try {
    const applicant = await searchInboundApplicant(
      auth.supabase,
      auth.tenantId,
      req.nextUrl.searchParams
    );
    if (!applicant) {
      auditInboundApiCall({
        req,
        auth,
        action: "inbound_api.applicants.search",
        entityType: "applicant",
        outcome: "success",
        metadata: { found: false },
      });
      return NextResponse.json({ found: false }, { status: 404 });
    }

    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.search",
      entityType: "applicant",
      entityId: applicant.applicant_id,
      outcome: "success",
      metadata: { found: true },
    });
    return NextResponse.json({
      found: true,
      applicant_id: applicant.applicant_id,
      email: applicant.email,
      phone: applicant.phone,
      full_name: applicant.full_name,
      created_at: applicant.created_at,
    });
  } catch (error) {
    auditInboundApiCall({
      req,
      auth,
      action: "inbound_api.applicants.search",
      entityType: "applicant",
      outcome: "failure",
      metadata: {
        message: error instanceof Error ? error.message : "unknown",
      },
    });
    if (error instanceof JobValidationError) {
      return integrationError(400, "VALIDATION_ERROR", error.message);
    }
    console.error("[api/v1/applicants/search]", error);
    return integrationError(500, "INTERNAL", "Failed to search applicants");
  }
}
