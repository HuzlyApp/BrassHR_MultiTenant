import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatApiError } from "@/lib/api/format-api-error";
import { loadApplicationPipeline } from "@/lib/applicant-portal/load-application-pipeline";

export const runtime = "nodejs";

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { applicationId } = await context.params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "Missing application id" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pipeline = await loadApplicationPipeline(supabase, {
      applicationId: applicationId.trim(),
      applicantAuthUserId: authData.user.id,
    });

    if (!pipeline) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json(pipeline);
  } catch (err) {
    console.error("[me/applications/pipeline]", err);
    return NextResponse.json({ error: formatApiError(err) }, { status: 500 });
  }
}
