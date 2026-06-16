import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import {
  archiveRecruiterTemplate,
  deleteRecruiterTemplateHard,
  getRecruiterTemplateDetail,
  updateRecruiterTemplate,
} from "@/lib/recruiter-templates/service";
import {
  saveRecruiterTemplateSchema,
  validateFieldMappings,
  validateRoleOrders,
} from "@/lib/recruiter-templates/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const template = await getRecruiterTemplateDetail(ctx.supabase, ctx.tenantId, id);
    return NextResponse.json({ template });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const body = saveRecruiterTemplateSchema.parse(await req.json());
    const roleIssues = validateRoleOrders(body.roles);
    const fieldIssues = validateFieldMappings(
      body.fields,
      new Set(body.roles.map((r) => r.role_key))
    );
    const issues = [...roleIssues, ...fieldIssues];
    if (issues.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", issues },
        { status: 400 }
      );
    }

    const template = await updateRecruiterTemplate(
      ctx.supabase,
      ctx.tenantId,
      id,
      body,
      ctx.auth.userId
    );

    return NextResponse.json({ template });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const url = new URL(req.url);
    const hard = url.searchParams.get("hard") === "true";

    if (hard) {
      await deleteRecruiterTemplateHard(ctx.supabase, ctx.tenantId, id);
      return NextResponse.json({ ok: true, deleted: true });
    }

    const template = await archiveRecruiterTemplate(
      ctx.supabase,
      ctx.tenantId,
      id,
      ctx.auth.userId
    );
    return NextResponse.json({ template, archived: true });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
