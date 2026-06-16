import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import { syncRecruiterTemplateFromFirma } from "@/lib/recruiter-templates/service";
import { syncRecruiterTemplateSchema } from "@/lib/recruiter-templates/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const body = syncRecruiterTemplateSchema.parse(await req.json());
    const template = await syncRecruiterTemplateFromFirma(
      ctx.supabase,
      ctx.tenantId,
      id,
      body,
      ctx.auth.userId
    );

    return NextResponse.json({ template, synced: true });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
