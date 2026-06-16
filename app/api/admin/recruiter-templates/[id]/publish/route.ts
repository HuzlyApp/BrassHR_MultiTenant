import { NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { publishRecruiterTemplate } from "@/lib/recruiter-templates/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const template = await publishRecruiterTemplate(
      ctx.supabase,
      ctx.tenantId,
      id,
      ctx.auth.userId
    );

    return NextResponse.json({ template, published: true });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
