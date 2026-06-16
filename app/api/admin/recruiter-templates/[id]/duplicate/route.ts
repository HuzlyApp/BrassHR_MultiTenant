import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { duplicateRecruiterTemplate } from "@/lib/recruiter-templates/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    let name: string | undefined;
    try {
      const body = (await req.json()) as { name?: string };
      name = body.name;
    } catch {
      name = undefined;
    }

    const template = await duplicateRecruiterTemplate(
      ctx.supabase,
      ctx.tenantId,
      id,
      ctx.auth.userId,
      name
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
