import { NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { createRecruiterTemplateBuilderSession } from "@/lib/recruiter-templates/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
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

    return NextResponse.json({ session });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
