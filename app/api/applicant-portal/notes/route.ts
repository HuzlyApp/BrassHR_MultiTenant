import { NextRequest, NextResponse } from "next/server";
import { findApplicantByUserId } from "@/lib/applicant-portal";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadWorkerNotesForWorkerId } from "@/lib/worker-notes";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function GET(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applicant = await findApplicantByUserId(supabase, data.user.id);
    if (!applicant?.id) {
      return NextResponse.json({ error: "Applicant not found" }, { status: 404 });
    }

    const notes = await loadWorkerNotesForWorkerId(supabase, applicant.id, {
      authorFallback: "Your recruiter",
    });

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("[applicant-portal/notes]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}