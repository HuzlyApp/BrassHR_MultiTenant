import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import {
  createRecruiterTemplate,
  listRecruiterTemplates,
} from "@/lib/recruiter-templates/service";
import {
  listRecruiterTemplatesQuerySchema,
  saveRecruiterTemplateSchema,
  validateFieldMappings,
  validateRoleOrders,
} from "@/lib/recruiter-templates/validation";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const url = new URL(req.url);
    const filters = listRecruiterTemplatesQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    const templates = await listRecruiterTemplates(ctx.supabase, ctx.tenantId, filters);
    return NextResponse.json({ tenantId: ctx.tenantId, templates });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

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

    const template = await createRecruiterTemplate(
      ctx.supabase,
      ctx.tenantId,
      body,
      ctx.auth.userId
    );

    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
