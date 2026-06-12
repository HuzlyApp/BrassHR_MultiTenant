import { NextRequest, NextResponse } from "next/server";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadWorkerNotesForWorkerId } from "@/lib/worker-notes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || "";
    if (!applicantId) {
      return NextResponse.json({ notes: [] });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ notes: [] });
    }

    const ctx = await resolveWorkerByApplicantId(supabase, applicantId);
    if (!ctx?.workerId) {
      return NextResponse.json({ notes: [] });
    }

    const notes = await loadWorkerNotesForWorkerId(supabase, ctx.workerId, {
      authorFallback: "Your recruiter",
    });

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[onboarding/worker-notes]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
