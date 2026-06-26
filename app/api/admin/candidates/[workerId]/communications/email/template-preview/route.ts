import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { previewCandidateEmailTemplate } from "@/lib/communication/preview-candidate-email-template";
import { resolveWorkerContact } from "@/lib/communication/resolve-worker";
import { resolveAppOrigin } from "@/lib/resolve-app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ workerId: string }> };

/** GET — render saved email template for a candidate (subject + body with placeholders filled). */
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiSession();
  if (auth instanceof NextResponse) return auth;

  const { workerId: workerIdRaw } = await context.params;
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId");
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }
  const workerId = idCheck.value;

  const url = new URL(req.url);
  const templateKey = url.searchParams.get("templateKey")?.trim() || "";
  if (!templateKey) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  const clientOrigin = url.searchParams.get("origin")?.trim() || undefined;
  const origin = resolveAppOrigin(req, clientOrigin);
  if (!origin) {
    return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const contact = await resolveWorkerContact(supabase, workerId);
  if (!contact) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!canAccessWorkerRecord(auth, { id: contact.id, user_id: contact.userId })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const preview = await previewCandidateEmailTemplate(supabase, {
      workerId,
      templateKey,
      origin,
      locale: url.searchParams.get("locale")?.trim() || "en",
    });

    if (!preview) {
      return NextResponse.json({ error: "Could not build template preview" }, { status: 404 });
    }

    return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Template preview failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
