import { NextRequest, NextResponse } from "next/server";
import { loadWorkerAccountOverview } from "@/lib/applicant-portal/load-worker-account-overview";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";

export const runtime = "nodejs";

function queryErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Could not load account overview";
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const workerId = auth.applicant.id;
    const tenantId = auth.applicant.tenant_id;

    const overview = await loadWorkerAccountOverview(auth.supabase, workerId, tenantId);
    if (!overview) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(overview);
  } catch (err) {
    console.error("[applicant-portal/account-overview:get]", err);
    return NextResponse.json({ error: queryErrorMessage(err) }, { status: 500 });
  }
}
