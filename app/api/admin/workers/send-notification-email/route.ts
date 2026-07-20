import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { sendOnboardingApplicantEmail } from "@/lib/email/send-templated-email";
import { SendEmailError } from "@/lib/email/errors";
import {
  EMAIL_TEMPLATE_TYPE,
  isOnboardingEmailTemplateKey,
} from "@/lib/email-templates/template-keys";
import { resolveApplicantEmailAppOrigin } from "@/lib/resolve-app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

const bodySchema = z.object({
  workerId: z.string().trim().min(1),
  templateKey: z.enum([
    EMAIL_TEMPLATE_TYPE.WELCOME,
    EMAIL_TEMPLATE_TYPE.DECLINED,
    EMAIL_TEMPLATE_TYPE.APPLICATION_STATUS,
    EMAIL_TEMPLATE_TYPE.APPROVED,
  ]),
  reason: z.string().trim().max(2000).optional(),
  clientOrigin: z.string().trim().optional(),
});

function handleError(e: unknown): NextResponse {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_ERROR" }, { status: 400 });
  }
  if (e instanceof SendEmailError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error("[admin/workers/send-notification-email]", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * POST — staff sends welcome, declined, or status-link email for a worker (tenant-scoped template).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession();
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
    }

    const body = bodySchema.parse(await req.json());
    const idCheck = parseRequiredUuid(body.workerId, "workerId");
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 });
    }

    if (!isOnboardingEmailTemplateKey(body.templateKey)) {
      return NextResponse.json({ error: "Invalid template key" }, { status: 400 });
    }

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, tenant_id, user_id")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (wErr) throw wErr;
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }

    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = String(worker.tenant_id);
    const scope = await resolveStaffTenantScope(auth.authUser);
    if (scope.mode === "scoped" && scope.tenantId !== tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const origin = resolveApplicantEmailAppOrigin(req, body.clientOrigin);
    if (!origin) {
      return NextResponse.json({ error: "Could not resolve app origin" }, { status: 400 });
    }

    const result = await sendOnboardingApplicantEmail(supabase, {
      tenantId,
      workerId: String(worker.id),
      templateKey: body.templateKey,
      origin,
      reason: body.reason,
    });

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      skipped: result.skipped ?? false,
      messageId: result.messageId ?? null,
    });
  } catch (e) {
    return handleError(e);
  }
}
