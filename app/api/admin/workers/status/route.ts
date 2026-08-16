import { NextRequest, NextResponse } from "next/server";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { sendOnboardingApplicantEmail } from "@/lib/email/send-templated-email";
import { SendEmailError } from "@/lib/email/errors";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import { resolveApplicantEmailAppOrigin } from "@/lib/resolve-app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

type PipelineStatus = "new" | "pending" | "for_approval" | "approved" | "disapproved";

function parsePipelineStatus(value: unknown): PipelineStatus | null {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    status === "new" ||
    status === "pending" ||
    status === "for_approval" ||
    status === "approved" ||
    status === "disapproved"
  ) {
    return status;
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      workerId?: string;
      status?: string;
    };
    const idCheck = parseRequiredUuid(body.workerId?.trim() ?? "", "workerId");
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const status = parsePipelineStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "Invalid worker status" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, user_id, tenant_id")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id || !worker.tenant_id) return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("worker")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", idCheck.value)
      .select("id, status")
      .maybeSingle();

    if (updateError) throw updateError;

    let approvalEmail:
      | { sent: boolean; skipped: boolean; messageId: string | null; error?: undefined }
      | { sent: false; skipped: false; messageId: null; error: string }
      | null = null;

    if (status === "approved") {
      try {
        const origin = resolveApplicantEmailAppOrigin(req);
        if (!origin) {
          approvalEmail = {
            sent: false,
            skipped: false,
            messageId: null,
            error: "Could not resolve app origin for approval email.",
          };
        } else {
          const result = await sendOnboardingApplicantEmail(supabase, {
            tenantId: String(worker.tenant_id),
            workerId: String(worker.id),
            templateKey: EMAIL_TEMPLATE_TYPE.APPROVED,
            origin,
          });
          approvalEmail = {
            sent: result.sent,
            skipped: result.skipped ?? false,
            messageId: result.messageId ?? null,
          };
        }
      } catch (emailError) {
        console.error("[admin/workers/status] approval email", emailError);
        approvalEmail = {
          sent: false,
          skipped: false,
          messageId: null,
          error:
            emailError instanceof SendEmailError || emailError instanceof Error
              ? emailError.message
              : "Could not send approval email.",
        };
      }
    }

    return NextResponse.json({ worker: updated, approvalEmail });
  } catch (err) {
    console.error("[admin/workers/status]", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
