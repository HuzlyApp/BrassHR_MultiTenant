import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiSession } from "@/lib/auth/api-session";
import { isStaffRole } from "@/lib/auth/app-role";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { resolveAppOrigin } from "@/lib/resolve-app-origin";
import { getSupabaseUrl } from "@/lib/supabase-env";
import { parseRequiredUuid } from "@/lib/validation/uuid";
import {
  createZohoEmbeddedSigningFromTemplate,
  createZohoEmbeddedSigningUrlForExistingRequest,
} from "@/lib/zoho-sign-embedded";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { workerId?: string; requestId?: string; actionId?: string };
  const workerIdCheck = parseRequiredUuid(String(body.workerId ?? "").trim(), "workerId");
  if (!workerIdCheck.ok) {
    return NextResponse.json({ error: workerIdCheck.error }, { status: 400 });
  }
  const workerId = workerIdCheck.value;

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(url, key);
  const { data: worker, error: workerErr } = await supabase
    .from("worker")
    .select("id, user_id, tenant_id, first_name, last_name, email")
    .eq("id", workerId)
    .maybeSingle();

  if (workerErr) throw workerErr;
  if (!worker?.id) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }
  if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = String(worker.email ?? "").trim().toLowerCase();
  const name =
    `${String(worker.first_name ?? "").trim()} ${String(worker.last_name ?? "").trim()}`.trim() ||
    "Applicant";
  if (!email) {
    return NextResponse.json({ error: "Applicant email is required for eSign." }, { status: 400 });
  }

  const appUrl = resolveAppOrigin(req);
  if (!appUrl) {
    return NextResponse.json({ error: "Could not determine app URL." }, { status: 500 });
  }

  const existingRequestId = body.requestId?.trim() || "";
  const existingActionId = body.actionId?.trim() || "";
  const templateId = process.env.ZOHO_SIGN_TEMPLATE_ID?.trim() || "";
  const returnUrl = `${appUrl}/application/zoho-sign-callback`;

  try {
    const { signingUrl, requestId, actionId } = existingRequestId
      ? await createZohoEmbeddedSigningUrlForExistingRequest({
          requestId: existingRequestId,
          actionId: existingActionId || undefined,
          recipientEmail: email,
          returnUrl,
          publicOrigin: appUrl,
        })
      : await createZohoEmbeddedSigningFromTemplate({
          templateId,
          email,
          name,
          returnUrl,
          publicOrigin: appUrl,
        });

    if (!existingRequestId && !templateId) {
      return NextResponse.json(
        { error: "Zoho Sign template is not configured (ZOHO_SIGN_TEMPLATE_ID)." },
        { status: 503 }
      );
    }

    await supabase.from("zoho_sign_requests").upsert(
      {
        user_id: worker.user_id ?? null,
        email,
        recipient_name: name,
        request_id: requestId,
        signing_url: signingUrl,
        status: "sent",
        source: "admin_recruiter",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id", ignoreDuplicates: false }
    );

    if (worker.tenant_id != null && worker.user_id) {
      await supabase.from("agreements").upsert(
        {
          tenant_id: String(worker.tenant_id),
          request_id: requestId,
          applicant_id: String(worker.user_id),
          status: "sent",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id", ignoreDuplicates: false }
      );
    }

    return NextResponse.json({
      ok: true,
      signingUrl,
      requestId,
      actionId,
      message: "eSign request sent to applicant.",
    });
  } catch (err: unknown) {
    console.error("[admin/worker-request-esign]", err);
    const msg = err instanceof Error ? err.message : "Failed to request eSign";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
