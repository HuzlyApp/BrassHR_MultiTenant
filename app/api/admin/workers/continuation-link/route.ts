import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import { resolveStaffTenantScope } from "@/lib/auth/staff-tenant-scope";
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access";
import { createApplicantContinuationLink } from "@/lib/onboarding/applicant-continuation-link";
import { resolveApplicantEmailAppOrigin } from "@/lib/resolve-app-origin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseRequiredUuid } from "@/lib/validation/uuid";

export const runtime = "nodejs";

const bodySchema = z.object({
  workerId: z.string().trim().min(1),
  clientOrigin: z.string().trim().optional(),
  markSent: z.boolean().optional(),
  reason: z
    .enum(["onboarding_reminder", "application_status", "resume_continuation", "welcome", "manual_notification"])
    .optional(),
});

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
    if (!idCheck.ok) return NextResponse.json({ error: idCheck.error }, { status: 400 });

    const { data: worker, error: workerError } = await supabase
      .from("worker")
      .select("id, tenant_id, user_id")
      .eq("id", idCheck.value)
      .maybeSingle();

    if (workerError) throw workerError;
    if (!worker?.id || !worker.tenant_id) {
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

    const link = await createApplicantContinuationLink(supabase, {
      workerId: String(worker.id),
      tenantId,
      origin,
      reason: body.reason ?? "manual_notification",
      markSent: body.markSent ?? false,
      metadata: { generated_by: auth.devBypass ? "dev_bypass" : auth.userId },
    });

    if (!link) {
      return NextResponse.json({ error: "Could not create continuation link" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      continuationLink: link.url,
      target: link.target,
      expiresAt: link.expiresAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", code: "VALIDATION_ERROR" }, { status: 400 });
    }
    console.error("[admin/workers/continuation-link]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
