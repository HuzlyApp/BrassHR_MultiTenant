import { NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { createRecruiterTemplateBuilderSession } from "@/lib/recruiter-templates/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const session = await createRecruiterTemplateBuilderSession(
      ctx.supabase,
      ctx.tenantId,
      id,
      ctx.auth.userId
    );

    return NextResponse.json({ session });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
