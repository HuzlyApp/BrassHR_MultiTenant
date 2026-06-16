import { NextRequest, NextResponse } from "next/server";
import {
  handleRecruiterTemplateRouteError,
  requireRecruiterTemplateAdminContext,
} from "@/lib/recruiter-templates/api-helpers";
import {
  createRecruiterTemplateSigningRequest,
  createSigningRequestFromDuplicate,
} from "@/lib/recruiter-templates/service";
import { createSigningRequestSchema } from "@/lib/recruiter-templates/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireRecruiterTemplateAdminContext();
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await context.params;
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    if (mode === "duplicate") {
      let name: string | undefined;
      try {
        const body = (await req.json()) as { name?: string };
        name = body.name;
      } catch {
        name = undefined;
      }
      const result = await createSigningRequestFromDuplicate(
        ctx.supabase,
        ctx.tenantId,
        id,
        name
      );
      return NextResponse.json(result, { status: 201 });
    }

    const body = createSigningRequestSchema.parse(await req.json());
    const result = await createRecruiterTemplateSigningRequest(
      ctx.supabase,
      ctx.tenantId,
      id,
      body
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return handleRecruiterTemplateRouteError(e);
  }
}
