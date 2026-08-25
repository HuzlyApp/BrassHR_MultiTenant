import { NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { createRecruiterTemplateBuilderSession } from "@/lib/recruiter-templates/service";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { randomUUID } from "crypto";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const correlationId = randomUUID();
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    let forceRecreate = false;
    let refreshDocument = false;
    try {
      const body = (await req.json()) as {
        force_recreate_firma_template?: unknown;
        refresh_firma_document?: unknown;
      };
      forceRecreate = body.force_recreate_firma_template === true;
      refreshDocument = body.refresh_firma_document === true;
    } catch {
      forceRecreate = false;
      refreshDocument = false;
    }

    const { id } = await context.params;
    const session = await createRecruiterTemplateBuilderSession(
      ctx.supabase,
      ctx.tenantId,
      id,
      ctx.auth.userId,
      { forceRecreate, refreshDocument }
    );

    if (forceRecreate) {
      await writeActivityLog({
        actorUserId: ctx.auth.userId,
        action: "recruiter_template.reset_signature_template",
        entityType: "recruiter_template",
        entityId: id,
        tenantId: ctx.tenantId,
        metadata: {
          correlationId,
          refreshDocument,
          firma_template_id: session.firma_template_id,
        },
        request: req,
      });
    }

    return NextResponse.json({
      session,
      correlationId,
      status: forceRecreate ? "reset" : refreshDocument ? "rebuilt" : "ready",
      expires_at: session.expires_at,
      document_id: session.firma_template_id,
    });
  } catch (e) {
    const response = handleRecruiterTemplateRouteError(e);
    try {
      const payload = await response.clone().json();
      return NextResponse.json({ ...payload, correlationId }, { status: response.status });
    } catch {
      return response;
    }
  }
}
