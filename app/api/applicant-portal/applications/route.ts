import { NextRequest, NextResponse } from "next/server";
import { formatApiError } from "@/lib/api/format-api-error";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { listWorkerJobApplications } from "@/lib/applicant-portal/list-worker-job-applications";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const applications = await listWorkerJobApplications(auth.supabase, {
      workerId: auth.applicant.id,
      tenantId: auth.applicant.tenant_id,
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[applicant-portal/applications:get]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
