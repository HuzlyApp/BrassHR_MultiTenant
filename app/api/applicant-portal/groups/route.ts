import { NextRequest, NextResponse } from "next/server";
import { requireApprovedApplicant } from "@/lib/applicant-portal/request";
import { loadApplicantAssignedGroups } from "@/lib/messaging/applicant-group-access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApprovedApplicant(req);
    if (auth instanceof NextResponse) return auth;

    const groups = await loadApplicantAssignedGroups(auth.supabase, auth.applicant.id);
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[applicant-portal/groups:get]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load group chats" },
      { status: 500 }
    );
  }
}
