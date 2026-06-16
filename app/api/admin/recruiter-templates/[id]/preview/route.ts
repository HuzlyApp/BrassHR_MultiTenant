import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { buildRecruiterTemplatePreview } from "@/lib/recruiter-templates/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const url = new URL(req.url);
    const readOnly = url.searchParams.get("readOnly") !== "false";

    const preview = await buildRecruiterTemplatePreview(
      ctx.supabase,
      ctx.tenantId,
      id,
      { readOnly }
    );

    return NextResponse.json({ preview });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
